import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import { duesRemainingCents, type DuesRemainingInputs } from './billing';

/**
 * A resolved broadcast recipient. Carries the bits the merge step needs
 * (name for {{firstName}}, override for {{duesAmount}}), not just an email.
 * `name` is null for a custom-typed address with no matching member.
 */
export interface Recipient {
  email: string;
  name: string | null;
  duesOverrideCents: number | null;
}

/**
 * Canonical "this member still owes dues" predicate, shared by the action-items
 * count, the mass-email recipient builder, and the email-list export so the
 * three can never drift.
 *
 * A member is unpaid only when their dues status is neither PAID nor WAIVED
 * (status wins — a manual PAID/WAIVED mark is authoritative) AND their recorded
 * DUES payments fall short of their effective dues (override ?? season amount).
 */
export function isDuesUnpaid(inputs: DuesRemainingInputs): boolean {
  if (inputs.duesStatus === 'PAID' || inputs.duesStatus === 'WAIVED') return false;
  return duesRemainingCents(inputs) > 0;
}

/** Audience segments a broadcast can target. */
export type RecipientFilter =
  | 'all'
  | 'confirmed'
  | 'unpaid_dues'
  | 'build_crew'
  | 'strike_crew'
  | 'not_on_whatsapp'
  | 'no_preapproval'
  | 'no_ticket'
  | 'no_travel_plans'
  | 'custom';

function dedupeByEmail(recipients: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  return recipients.filter((r) => {
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
}

/**
 * Resolve a segment to a de-duplicated list of recipient records (with the
 * name + dues data the merge step needs) for one season. Shared by the
 * mass-email send path so the audience rules — especially the corrected
 * unpaid-dues rule (isDuesUnpaid) — live in exactly one place.
 *
 * Throws NOT_FOUND for an unknown season and BAD_REQUEST when the custom
 * filter is chosen with no addresses. Returns [] when a filter matches nobody;
 * the caller decides how to surface an empty audience.
 */
export async function resolveRecipients(
  prisma: PrismaClient,
  opts: { seasonId: string; filter: RecipientFilter; customEmails?: string[] },
): Promise<Recipient[]> {
  const { seasonId, filter, customEmails } = opts;

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, duesAmount: true },
  });
  if (!season) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
  }

  if (filter === 'custom') {
    if (!customEmails || customEmails.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'customEmails must be provided when using the "custom" filter',
      });
    }
    const known = await prisma.member.findMany({
      where: { email: { in: customEmails } },
      select: { email: true, name: true },
    });
    const nameByEmail = new Map(known.map((m) => [m.email, m.name]));
    // Custom addresses use the season's default dues amount for {{duesAmount}}
    // (no per-member override resolved for ad-hoc recipients).
    return dedupeByEmail(
      customEmails.map((email) => ({
        email,
        name: nameByEmail.get(email) ?? null,
        duesOverrideCents: null,
      })),
    );
  }

  const seasonMembers = await prisma.seasonMember.findMany({
    where: { seasonId, status: { not: 'CANCELLED' } },
    include: {
      member: { select: { id: true, email: true, name: true } },
      payments: { where: { type: 'DUES' }, select: { amount: true } },
    },
  });

  const toRecipient = (sm: (typeof seasonMembers)[number]): Recipient => ({
    email: sm.member.email,
    name: sm.member.name,
    duesOverrideCents: sm.duesOverrideCents,
  });

  let chosen: typeof seasonMembers = [];
  switch (filter) {
    case 'all':
      chosen = seasonMembers;
      break;
    case 'confirmed':
      chosen = seasonMembers.filter((sm) => sm.status === 'CONFIRMED');
      break;
    case 'unpaid_dues':
      chosen = seasonMembers.filter((sm) =>
        isDuesUnpaid({
          duesStatus: sm.duesStatus,
          duesOverrideCents: sm.duesOverrideCents,
          seasonDuesCents: season.duesAmount,
          duesPaidCents: sm.payments.reduce((sum, p) => sum + p.amount, 0),
        }),
      );
      break;
    case 'build_crew':
      chosen = seasonMembers.filter((sm) => sm.buildCrew);
      break;
    case 'strike_crew':
      chosen = seasonMembers.filter((sm) => sm.strikeCrew);
      break;
    case 'not_on_whatsapp':
      chosen = seasonMembers.filter((sm) => !sm.addedToWhatsApp);
      break;
    case 'no_travel_plans':
      chosen = seasonMembers.filter((sm) => !sm.travelUpdatedAt);
      break;
    case 'no_preapproval':
      chosen = seasonMembers.filter((sm) => sm.preApprovalForm === null || sm.preApprovalForm === 'NO');
      break;
    case 'no_ticket': {
      const withTickets = await prisma.ticket.findMany({
        where: { seasonId },
        select: { memberId: true },
      });
      const ticketMemberIds = new Set(withTickets.map((t) => t.memberId));
      chosen = seasonMembers.filter((sm) => !ticketMemberIds.has(sm.member.id));
      break;
    }
  }

  return dedupeByEmail(chosen.map(toRecipient));
}
