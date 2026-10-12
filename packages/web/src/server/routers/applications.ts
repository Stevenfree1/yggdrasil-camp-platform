import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, PrismaClient } from '@prisma/client';
import { router, publicProcedure, managerProcedure, leadProcedure } from '../trpc';
import logger from '../lib/logger';
import { signInviteToken } from '../lib/auth';
import {
  sendApplicationConfirmation,
  sendApplicationApproved,
  sendApplicationDenied,
  sendProfileSetupEmail,
  sendWelcomeBackEmail,
  sendPreApprovalExpiredEmail,
  sendWelcomeEmail,
} from '../lib/email';

// ─── Validation schemas ──────────────────────────────────────────────────

const applicationStatusEnum = z.enum([
  // Legacy values, preserved for backward compat with older rows
  'PENDING',
  'REVIEWED',
  // Phase A pipeline stages
  'SUBMITTED',
  'UNDER_REVIEW',
  'PRE_APPROVED',
  'APPROVED',
  'INVITED',
  'ACCEPTED',
  'DUES_PAID',
  'CONFIRMED',
  'WAITLISTED',
  'DECLINED',
  'REJECTED', // legacy alias for DECLINED
  'WITHDRAWN',
]);

const experienceEnum = z.enum(['FIRST_TIMER', 'BEEN_BEFORE', 'VETERAN']);

const submitApplicationInput = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().min(1, 'Phone number is required').max(20),
  playaName: z.string().max(100).optional(),
  referredBy: z.string().max(200).optional(),
  experience: experienceEnum,
  // Phase A optional fields (new form versions populate these)
  isBurningManFirstTime: z.boolean().optional(),
  isCampReturning: z.boolean().optional(),
  hasTicket: z.boolean().optional(),
  strikeCommitment: z.boolean().optional(),
  motivationText: z.string().max(5000).optional(),
  groupMembersText: z.string().max(2000).optional(),
  // Legacy fields kept for compat
  interests: z.string().max(2000).optional(),
  contribution: z.string().max(2000).optional(),
  dietaryRestrictions: z.string().max(500).optional(),
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
  housingPreference: z.string().max(500).optional(),
  message: z.string().max(5000).optional(),
});

const listApplicationsInput = z
  .object({
    status: applicationStatusEnum.optional(),
    statuses: z.array(applicationStatusEnum).optional(), // multi-status filter
    seasonId: z.string().uuid().optional(),
    search: z.string().max(200).optional(),
    experience: experienceEnum.optional(),
    sponsorMemberId: z.string().uuid().optional(),
    householdId: z.string().uuid().optional(),
    hasTicket: z.boolean().optional(),
    isCampReturning: z.boolean().optional(),
    needsSponsorReview: z.boolean().optional(), // referredBy set but sponsorMemberId null
    sortBy: z.enum(['createdAt', 'submittedAt', 'name', 'email', 'status']).optional().default('submittedAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    limit: z.number().int().min(1).max(200).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
  })
  .optional()
  .default({});

// ─── Status transition helpers ───────────────────────────────────────────

type EmailKind = 'invited' | 'declined' | 'approved' | 'welcome' | null;

type StatusTransition = {
  timestampField: keyof Prisma.ApplicationUpdateInput | null;
  sendEmail?: EmailKind;
};

/** Returns the side effects (timestamp field + email kind) for transitioning into `status`. */
function transitionFor(status: z.infer<typeof applicationStatusEnum>): StatusTransition {
  switch (status) {
    case 'PRE_APPROVED': return { timestampField: 'preApprovedAt' };
    case 'APPROVED':     return { timestampField: null };
    case 'INVITED':      return { timestampField: 'invitedAt', sendEmail: 'invited' };
    case 'ACCEPTED':     return { timestampField: 'acceptedAt', sendEmail: 'approved' };
    case 'DUES_PAID':    return { timestampField: 'duesPaidAt' };
    case 'CONFIRMED':    return { timestampField: 'confirmedAt', sendEmail: 'welcome' };
    case 'DECLINED':
    case 'REJECTED':     return { timestampField: 'declinedAt', sendEmail: 'declined' };
    case 'WITHDRAWN':    return { timestampField: 'withdrawnAt' };
    default:             return { timestampField: null };
  }
}

type ResendKind = 'confirmation' | 'approved' | 'welcome' | 'declined' | null;

/**
 * Which email an admin can re-send for an application sitting at `status`.
 * Broader than transitionFor(): early stages map to the submission
 * confirmation, so the full sequence can be replayed for testing.
 */
function resendEmailKindFor(status: string): ResendKind {
  switch (status) {
    case 'SUBMITTED':
    case 'PENDING':
    case 'REVIEWED':
    case 'UNDER_REVIEW':
      return 'confirmation';
    case 'PRE_APPROVED':
      return null; // pre-approval no longer carries a dues email
    case 'INVITED':
    case 'ACCEPTED':
      return 'approved';
    case 'CONFIRMED':
      return 'welcome';
    case 'DECLINED':
    case 'REJECTED':
      return 'declined';
    default:
      return null; // DUES_PAID, WAITLISTED, WITHDRAWN — no stage email
  }
}

async function fireTransitionEmail(
  kind: EmailKind,
  email: string,
  name: string,
) {
  if (!kind) return;
  try {
    if (kind === 'invited' || kind === 'approved') {
      await sendApplicationApproved(email, name);
    } else if (kind === 'declined') {
      await sendApplicationDenied(email, name);
    } else if (kind === 'welcome') {
      await sendWelcomeEmail(email, name);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to send application ${kind} email to ${email}: ${message}`);
  }
}

// ─── Application → Member account bridge ───────────────────────────────────

type BridgeApp = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  playaName: string | null;
  isBurningManFirstTime: boolean | null;
  isCampReturning: boolean | null;
};

type BridgeResult = {
  memberId: string;
  outcome: 'created' | 'setup' | 'welcome_back';
  emailSent: boolean;
};

/**
 * Turns an approved application into a real member account + active-season
 * roster entry. Idempotent. Identity matched by email OR previousEmails:
 *   - no member            → create account (no password) + "set up your account" email
 *   - member, no password  → reuse + "set up your account" email
 *   - member, has password → reuse, NEVER reset password + "welcome back" email
 * A SeasonMember (CONFIRMED) is created for the active season if one exists and
 * the member isn't already on the roster (dues are tracked separately).
 */
async function bridgeApplicationToMember(
  prisma: PrismaClient,
  app: BridgeApp,
): Promise<BridgeResult> {
  const email = app.email.toLowerCase().trim();

  const existing = await prisma.member.findFirst({
    where: { OR: [{ email }, { previousEmails: { has: email } }] },
    select: { id: true, passwordHash: true, isActive: true },
  });

  let memberId: string;
  let outcome: BridgeResult['outcome'];

  if (!existing) {
    const created = await prisma.member.create({
      data: {
        email,
        name: app.name,
        phone: app.phone ?? undefined,
        playaName: app.playaName ?? undefined,
        role: 'MEMBER',
        isActive: true,
        emailVerified: false,
      },
      select: { id: true },
    });
    memberId = created.id;
    outcome = 'created';
  } else {
    memberId = existing.id;
    if (!existing.isActive) {
      await prisma.member.update({ where: { id: memberId }, data: { isActive: true } });
    }
    // Returning member with a password set → welcome back, never reset.
    outcome = existing.passwordHash ? 'welcome_back' : 'setup';
  }

  // Add to the active season's roster, idempotently (don't clobber an existing row).
  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (activeSeason) {
    await prisma.seasonMember.upsert({
      where: { seasonId_memberId: { seasonId: activeSeason.id, memberId } },
      update: {},
      create: {
        seasonId: activeSeason.id,
        memberId,
        status: 'CONFIRMED',
        isBMVirgin: app.isBurningManFirstTime === true,
        isCampVirgin: app.isCampReturning === false,
      },
    });
  }

  let emailSent = false;
  if (outcome === 'welcome_back') {
    emailSent = await sendWelcomeBackEmail(email, app.name);
  } else {
    const inviteToken = signInviteToken(memberId);
    emailSent = await sendProfileSetupEmail(email, app.name, inviteToken);
  }

  return { memberId, outcome, emailSent };
}

// ─── Router ──────────────────────────────────────────────────────────────

export const applicationsRouter = router({
  /** Submit a new membership application (public) */
  submit: publicProcedure
    .input(submitApplicationInput)
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email.toLowerCase().trim();

      // Block duplicate live applications. Anything past INVITED counts as "in flight";
      // anything DECLINED/WITHDRAWN/REJECTED can re-apply.
      const existing = await ctx.prisma.application.findFirst({
        where: {
          email: normalizedEmail,
          status: { in: ['PENDING', 'REVIEWED', 'SUBMITTED', 'UNDER_REVIEW', 'PRE_APPROVED', 'APPROVED', 'INVITED', 'ACCEPTED', 'DUES_PAID', 'CONFIRMED', 'WAITLISTED'] },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An application with this email is already under review',
        });
      }

      // Tie to the active season if one exists
      const activeSeason = await ctx.prisma.season.findFirst({ where: { isActive: true } });

      const application = await ctx.prisma.application.create({
        data: {
          name: input.name,
          email: normalizedEmail,
          phone: input.phone,
          playaName: input.playaName,
          referredBy: input.referredBy,
          experience: input.experience,
          isBurningManFirstTime: input.isBurningManFirstTime,
          isCampReturning: input.isCampReturning,
          hasTicket: input.hasTicket,
          strikeCommitment: input.strikeCommitment,
          motivationText: input.motivationText,
          groupMembersText: input.groupMembersText,
          interests: input.interests,
          contribution: input.contribution,
          dietaryRestrictions: input.dietaryRestrictions,
          emergencyContactName: input.emergencyContactName,
          emergencyContactPhone: input.emergencyContactPhone,
          housingPreference: input.housingPreference,
          message: input.message,
          source: 'NATIVE_FORM',
          status: 'SUBMITTED',
          seasonId: activeSeason?.id ?? null,
        },
      });

      logger.info(`New application submitted: ${normalizedEmail}`);

      try {
        await sendApplicationConfirmation(normalizedEmail, input.name);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to send application confirmation email to ${normalizedEmail}: ${message}`);
      }

      return {
        id: application.id,
        status: application.status,
        message: 'Application submitted successfully. We will review it and get back to you.',
      };
    }),

  /** List applications with filters, search, and pagination (manager+) */
  list: managerProcedure
    .input(listApplicationsInput)
    .query(async ({ ctx, input }) => {
      const where: Prisma.ApplicationWhereInput = {};

      if (input.status) where.status = input.status;
      if (input.statuses && input.statuses.length > 0) where.status = { in: input.statuses };
      if (input.seasonId) where.seasonId = input.seasonId;
      if (input.experience) where.experience = input.experience;
      if (input.sponsorMemberId) where.sponsorMemberId = input.sponsorMemberId;
      if (input.householdId) where.householdId = input.householdId;
      if (input.hasTicket !== undefined) where.hasTicket = input.hasTicket;
      if (input.isCampReturning !== undefined) where.isCampReturning = input.isCampReturning;
      if (input.needsSponsorReview) {
        where.AND = [
          { referredBy: { not: null } },
          { sponsorMemberId: null },
        ];
      }

      if (input.search) {
        const searchOR: Prisma.ApplicationWhereInput[] = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { email: { contains: input.search, mode: 'insensitive' } },
          { playaName: { contains: input.search, mode: 'insensitive' } },
          { referredBy: { contains: input.search, mode: 'insensitive' } },
        ];
        // Compose with any existing AND clauses
        if (where.AND) {
          where.AND = Array.isArray(where.AND) ? [...where.AND, { OR: searchOR }] : [where.AND, { OR: searchOR }];
        } else {
          where.OR = searchOR;
        }
      }

      const [applications, total] = await Promise.all([
        ctx.prisma.application.findMany({
          where,
          include: {
            sponsorMember: { select: { id: true, name: true, email: true } },
            reviewedByMember: { select: { id: true, name: true } },
            household: { select: { id: true, name: true } },
            season: { select: { id: true, year: true, name: true } },
          },
          orderBy: { [input.sortBy]: input.sortOrder },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.application.count({ where }),
      ]);

      return { applications, total, limit: input.limit, offset: input.offset };
    }),

  /** Get a single application by ID with relations (manager+) */
  getById: managerProcedure
    .input(z.object({ id: z.string().uuid('Invalid application ID') }))
    .query(async ({ ctx, input }) => {
      const application = await ctx.prisma.application.findUnique({
        where: { id: input.id },
        include: {
          sponsorMember: { select: { id: true, name: true, email: true } },
          reviewedByMember: { select: { id: true, name: true } },
          household: { include: { applications: { select: { id: true, name: true, email: true, status: true } } } },
          season: { select: { id: true, year: true, name: true } },
        },
      });

      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
      }

      return application;
    }),

  /** Update status with stage-aware side effects (timestamp + email) (admin only) */
  updateStatus: leadProcedure
    .input(z.object({
      applicationId: z.string().uuid('Invalid application ID'),
      status: applicationStatusEnum,
      reviewNotes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.prisma.application.findUnique({
        where: { id: input.applicationId },
      });

      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
      }

      const transition = transitionFor(input.status);

      const data: Prisma.ApplicationUpdateInput = {
        status: input.status,
        reviewedBy: ctx.user.id, // legacy string field
        reviewedByMember: { connect: { id: ctx.user.id } },
        reviewedAt: new Date(),
      };

      if (transition.timestampField) {
        (data as Record<string, unknown>)[transition.timestampField] = new Date();
      }
      if (input.reviewNotes !== undefined) {
        data.reviewNotes = input.reviewNotes;
      }

      const updated = await ctx.prisma.application.update({
        where: { id: input.applicationId },
        data,
      });

      logger.info(`Application ${input.applicationId} → ${input.status} by ${ctx.user.email}`);

      // Inviting creates the member account + roster entry (the email is sent
      // by the bridge). Other stages send their plain transition email. A bridge
      // failure must not fail the status change, so it's best-effort here.
      if (input.status === 'INVITED') {
        try {
          const bridged = await bridgeApplicationToMember(ctx.prisma, updated);
          logger.info(
            `Application ${input.applicationId} bridged to member ${bridged.memberId} (${bridged.outcome}) by ${ctx.user.email}`,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`Account bridge failed for application ${input.applicationId}: ${message}`);
        }
      } else {
        await fireTransitionEmail(transition.sendEmail ?? null, updated.email, updated.name);
      }

      return updated;
    }),

  /**
   * Re-send the email associated with an application's current stage, without
   * changing its status. Lets admins re-trigger a confirmation / approval /
   * welcome / etc. (e.g. to test the flow, or if the original bounced). Surfaces
   * a real error if the send fails, and the EmailLog records the resend.
   */
  resendStatusEmail: leadProcedure
    .input(z.object({ applicationId: z.string().uuid('Invalid application ID') }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.prisma.application.findUnique({
        where: { id: input.applicationId },
      });
      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
      }

      const kind = resendEmailKindFor(application.status);
      if (!kind) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `There's no email associated with the "${application.status}" stage to resend.`,
        });
      }

      const { email, name } = application;
      let ok = false;
      try {
        if (kind === 'confirmation') {
          ok = await sendApplicationConfirmation(email, name);
        } else if (kind === 'approved') {
          // Re-running approval ensures the member account/roster exist and
          // re-sends the right email (setup link, or welcome-back if they
          // already have an account). This is how an already-ACCEPTED
          // applicant (e.g. Ace) gets their account created.
          const bridged = await bridgeApplicationToMember(ctx.prisma, application);
          ok = bridged.emailSent;
        } else if (kind === 'declined') {
          ok = await sendApplicationDenied(email, name);
        } else if (kind === 'welcome') {
          ok = await sendWelcomeEmail(email, name);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Resend ${kind} email failed for application ${application.id}: ${message}`);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed to send email: ${message}` });
      }

      if (!ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'The email could not be sent. Check the email log for details.',
        });
      }

      logger.info(`Resent ${kind} email for application ${application.id} to ${email} by ${ctx.user.email}`);
      return { success: true, email, kind };
    }),

  /**
   * Backward-compatible review endpoint — same shape as before.
   *
   * LEGACY-ONLY. The canonical account-creation trigger in the new funnel is
   * INVITED (see `updateStatus` and `bulkUpdateStatus`, which bridge there).
   * The new app-card UI never sends ACCEPTED, so it never advances an
   * application into the legacy ACCEPTED→DUES_PAID→CONFIRMED chain. This path
   * exists only so older callers / the bulk-"Ace" import flow that still emit
   * ACCEPTED continue to create members. Its ACCEPTED→bridge step below is the
   * retained legacy compatibility path, NOT a surface exposed by any new button.
   */
  review: leadProcedure
    .input(z.object({
      applicationId: z.string().uuid('Invalid application ID'),
      status: z.enum(['ACCEPTED', 'REJECTED', 'WAITLISTED']),
      reviewNotes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Delegate to updateStatus logic so emails + timestamps fire correctly.
      const transition = transitionFor(input.status);
      const application = await ctx.prisma.application.findUnique({
        where: { id: input.applicationId },
      });
      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
      }

      const data: Prisma.ApplicationUpdateInput = {
        status: input.status,
        reviewedBy: ctx.user.id,
        reviewedByMember: { connect: { id: ctx.user.id } },
        reviewedAt: new Date(),
      };
      if (transition.timestampField) {
        (data as Record<string, unknown>)[transition.timestampField] = new Date();
      }
      if (input.reviewNotes !== undefined) {
        data.reviewNotes = input.reviewNotes;
      }

      const updated = await ctx.prisma.application.update({
        where: { id: input.applicationId },
        data,
      });

      logger.info(`Application ${input.applicationId} ${input.status} by ${ctx.user.email}`);

      // LEGACY-ONLY bridge. ACCEPTED is this legacy path's "we want them" signal,
      // so it must create the member account + roster entry (so the legacy/bulk
      // "Ace" path still creates members at scale). INVITED is the canonical
      // account-creation trigger for the new funnel (see updateStatus /
      // bulkUpdateStatus); the new app-card never sends ACCEPTED, so this branch
      // only fires for legacy callers. The bridge sends its own setup/welcome-back
      // email; for other statuses fall back to the plain transition email.
      // Best-effort so a bridge failure doesn't fail the status change.
      if (input.status === 'ACCEPTED') {
        try {
          const bridged = await bridgeApplicationToMember(ctx.prisma, updated);
          logger.info(
            `Application ${input.applicationId} bridged to member ${bridged.memberId} (${bridged.outcome}) by ${ctx.user.email}`,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`Account bridge failed for application ${input.applicationId}: ${message}`);
        }
      } else {
        await fireTransitionEmail(transition.sendEmail ?? null, updated.email, updated.name);
      }
      return updated;
    }),

  /**
   * Sweep pre-approved applicants whose dues deadline has passed: move them to
   * WAITLISTED and email them. Admin-runnable, and intended to be hit daily by
   * a cron (POST with a manager session, or via a scheduled task that calls it).
   * `dryRun` returns who *would* be expired without changing anything.
   *
   * LEGACY-ONLY. The pre-approval dues-deadline flow is retired (spec §4.F): the
   * dues clock was removed and `preApprovalExpiresAt` is no longer written by any
   * code path, so this sweep is a no-op against new rows. It is retained solely
   * to service pre-existing legacy rows that still carry a non-null
   * `preApprovalExpiresAt`. PRE_APPROVED is now an optional fast-track TAG that
   * carries no dues email or expiry clock. `sendPreApprovalExpiredEmail` and the
   * `PRE_APPROVAL_EXPIRED` EmailType member are kept only for this legacy path.
   */
  expireOverduePreApprovals: managerProcedure
    .input(z.object({ dryRun: z.boolean().optional().default(false) }).optional().default({}))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const overdue = await ctx.prisma.application.findMany({
        where: {
          status: 'PRE_APPROVED',
          preApprovalExpiresAt: { not: null, lt: now },
        },
        select: { id: true, email: true, name: true, preApprovalExpiresAt: true },
      });

      if (input.dryRun) {
        return { found: overdue.length, expired: 0, applicants: overdue.map((a) => a.email) };
      }

      let expired = 0;
      for (const app of overdue) {
        await ctx.prisma.application.update({
          where: { id: app.id },
          data: { status: 'WAITLISTED' },
        });
        try {
          await sendPreApprovalExpiredEmail(app.email, app.name);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`Failed to send pre-approval-expired email to ${app.email}: ${message}`);
        }
        expired++;
      }
      logger.info(`Expired ${expired} overdue pre-approval(s) by ${ctx.user.email}`);
      return { found: overdue.length, expired, applicants: overdue.map((a) => a.email) };
    }),

  /** Bulk status update across multiple applications (admin only) */
  bulkUpdateStatus: leadProcedure
    .input(z.object({
      applicationIds: z.array(z.string().uuid()).min(1).max(100),
      status: applicationStatusEnum,
      reviewNotes: z.string().max(2000).optional(),
      sendEmails: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const transition = transitionFor(input.status);

      const apps = await ctx.prisma.application.findMany({
        where: { id: { in: input.applicationIds } },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          playaName: true,
          isBurningManFirstTime: true,
          isCampReturning: true,
        },
      });

      await ctx.prisma.application.updateMany({
        where: { id: { in: input.applicationIds } },
        data: {
          status: input.status,
          reviewedBy: ctx.user.id,
          reviewedByMemberId: ctx.user.id,
          reviewedAt: new Date(),
          ...(transition.timestampField ? { [transition.timestampField]: new Date() } : {}),
          ...(input.reviewNotes !== undefined ? { reviewNotes: input.reviewNotes } : {}),
        },
      });

      logger.info(`Bulk: ${apps.length} applications → ${input.status} by ${ctx.user.email}`);

      // Bulk-inviting must create member accounts + roster entries, just like
      // the single-row path. The bridge sends its own setup/welcome-back email,
      // so we SKIP the plain transition-email loop for INVITED (below) to avoid
      // a double send. Best-effort per app so one failure doesn't abort the batch.
      if (input.status === 'INVITED') {
        for (const a of apps) {
          try {
            const bridged = await bridgeApplicationToMember(ctx.prisma, a);
            logger.info(
              `Application ${a.id} bridged to member ${bridged.memberId} (${bridged.outcome}) by ${ctx.user.email}`,
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`Account bridge failed for application ${a.id}: ${message}`);
          }
        }
      }

      if (input.sendEmails && transition.sendEmail && input.status !== 'INVITED') {
        for (const a of apps) {
          await fireTransitionEmail(transition.sendEmail, a.email, a.name);
        }
      }

      return { count: apps.length };
    }),

  /** Set or clear the sponsor link on an application (admin only) */
  setSponsor: leadProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      sponsorMemberId: z.string().uuid().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.sponsorMemberId) {
        const member = await ctx.prisma.member.findUnique({
          where: { id: input.sponsorMemberId },
          select: { id: true },
        });
        if (!member) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Sponsor member not found' });
        }
      }

      const updated = await ctx.prisma.application.update({
        where: { id: input.applicationId },
        data: { sponsorMemberId: input.sponsorMemberId },
      });

      return updated;
    }),

  /** Assign (or unassign) an application to a household (admin only) */
  setHousehold: leadProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      householdId: z.string().uuid().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.householdId) {
        const household = await ctx.prisma.household.findUnique({
          where: { id: input.householdId },
          select: { id: true },
        });
        if (!household) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' });
        }
      }

      const updated = await ctx.prisma.application.update({
        where: { id: input.applicationId },
        data: { householdId: input.householdId },
      });

      return updated;
    }),

  /** Create a new household for a season (admin only) */
  createHousehold: leadProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      name: z.string().max(120).optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const household = await ctx.prisma.household.create({
        data: { seasonId: input.seasonId, name: input.name, notes: input.notes },
      });
      return household;
    }),

  /** List households for a season (manager+) */
  listHouseholds: managerProcedure
    .input(z.object({ seasonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.household.findMany({
        where: { seasonId: input.seasonId },
        include: {
          applications: { select: { id: true, name: true, email: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /** Delete an application (admin only) */
  delete: leadProcedure
    .input(z.object({ id: z.string().uuid('Invalid application ID') }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.prisma.application.findUnique({
        where: { id: input.id },
      });

      if (!application) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found' });
      }

      await ctx.prisma.application.delete({ where: { id: input.id } });

      logger.info(`Application ${input.id} deleted by ${ctx.user.email}`);

      return { success: true };
    }),

  /** Status counts + capacity tracker (manager+) */
  getCounts: managerProcedure
    .input(z.object({ seasonId: z.string().uuid().optional() }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const where: Prisma.ApplicationWhereInput = {};
      if (input.seasonId) where.seasonId = input.seasonId;

      const counts = await ctx.prisma.application.groupBy({
        by: ['status'],
        where,
        _count: true,
      });

      const statusMap: Record<string, number> = {
        PENDING: 0,
        REVIEWED: 0,
        SUBMITTED: 0,
        UNDER_REVIEW: 0,
        PRE_APPROVED: 0,
        APPROVED: 0,
        INVITED: 0,
        ACCEPTED: 0,
        DUES_PAID: 0,
        CONFIRMED: 0,
        WAITLISTED: 0,
        DECLINED: 0,
        REJECTED: 0,
        WITHDRAWN: 0,
      };
      for (const c of counts) {
        if (c.status in statusMap) statusMap[c.status] = c._count;
      }

      // Capacity context — only meaningful when scoped to a specific season
      let capacity: { capacity: number | null; confirmedCount: number; remaining: number | null } | null = null;
      if (input.seasonId) {
        const season = await ctx.prisma.season.findUnique({
          where: { id: input.seasonId },
          select: { capacity: true },
        });
        // INVITED is now the account-creation point (member + roster spot), so it
        // holds a seat against capacity — as do the legacy ACCEPTED/DUES_PAID/CONFIRMED
        // statuses. An application has exactly one status, so there's no double-count.
        const confirmedCount =
          statusMap.INVITED + statusMap.ACCEPTED + statusMap.DUES_PAID + statusMap.CONFIRMED;
        capacity = {
          capacity: season?.capacity ?? null,
          confirmedCount,
          remaining: season?.capacity != null ? Math.max(0, season.capacity - confirmedCount) : null,
        };
      }

      const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
      return { ...statusMap, total, capacity };
    }),
});
