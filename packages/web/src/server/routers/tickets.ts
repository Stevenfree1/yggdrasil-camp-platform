import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, PrismaClient } from '@prisma/client';
import { router, leadProcedure, managerProcedure } from '../trpc';
import logger from '../lib/logger';

type AnyPrisma = PrismaClient | Prisma.TransactionClient;

// ─── Validation schemas ──────────────────────────────────────────────────

const ticketStatusEnum = z.enum([
  'INVITED',
  'CONTACTED',
  'PURCHASED_CONFIRMED',
  'VEHICLE_PASS_CONFIRMED',
  'REMOVED',
  'GOT_OUTSIDE',
]);

const ticketSourceEnum = z.enum([
  'DGS_DIRECT',
  'WAITLIST_FULFILLED',
  'OUTSIDE_SALE',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Resolve a memberId from a name + email by:
 *  1. case-insensitive match on Member.email (primary)
 *  2. case-insensitive match on Member.previousEmails array
 *  3. name match (last resort, only if exact-match)
 *
 * Returns the Member row if found, or null. Used by both manual entry and
 * bulk-paste / historical-import flows.
 */
async function resolveMember(
  prisma: AnyPrisma,
  email: string | null | undefined,
  name: string | null | undefined,
): Promise<{ id: string; name: string; email: string } | null> {
  const normalizedEmail = email?.toLowerCase().trim() || null;
  if (normalizedEmail) {
    // Primary email match (case-insensitive)
    const byEmail = await prisma.member.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, name: true, email: true },
    });
    if (byEmail) return byEmail;
    // previousEmails is a String[] — exact-match via `has`
    const byPrev = await prisma.member.findFirst({
      where: { previousEmails: { has: normalizedEmail } },
      select: { id: true, name: true, email: true },
    });
    if (byPrev) return byPrev;
  }
  if (name && name.trim().length >= 2) {
    const byName = await prisma.member.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
      select: { id: true, name: true, email: true },
    });
    if (byName) return byName;
  }
  return null;
}

/** Find a season by year. Throws NOT_FOUND if missing. */
async function seasonByYear(prisma: AnyPrisma, year: number) {
  const season = await prisma.season.findUnique({ where: { year } });
  if (!season) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `No season for year ${year}` });
  }
  return season;
}

/** Apply the side-effect timestamps + boolean flags for a target status. */
function dataForStatus(
  status: z.infer<typeof ticketStatusEnum>,
  existing: { contactedAt: Date | null; purchasedAt: Date | null },
): Prisma.TicketUpdateInput {
  const now = new Date();
  const data: Prisma.TicketUpdateInput = { status };
  switch (status) {
    case 'CONTACTED':
      if (!existing.contactedAt) data.contactedAt = now;
      break;
    case 'PURCHASED_CONFIRMED':
      data.purchaseConfirmed = true;
      if (!existing.contactedAt) data.contactedAt = now;
      if (!existing.purchasedAt) data.purchasedAt = now;
      break;
    case 'VEHICLE_PASS_CONFIRMED':
      data.purchaseConfirmed = true;
      data.vehiclePass = true;
      if (!existing.contactedAt) data.contactedAt = now;
      if (!existing.purchasedAt) data.purchasedAt = now;
      break;
    case 'REMOVED':
      data.removedAt = now;
      break;
    case 'GOT_OUTSIDE':
      data.source = 'OUTSIDE_SALE';
      data.purchasedAt = existing.purchasedAt ?? now;
      break;
    case 'INVITED':
      // re-invite from REMOVED / WAITLIST: clear removedAt
      data.removedAt = null;
      break;
    default:
      break;
  }
  return data;
}

// ─── Router ──────────────────────────────────────────────────────────────

export const ticketsRouter = router({
  /**
   * List all DGS allocations + waitlist for a given season.
   * `year` defaults to the active season's year if not provided.
   */
  listForSeason: managerProcedure
    .input(z.object({ year: z.number().int().optional() }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const season = input.year
        ? await seasonByYear(ctx.prisma, input.year)
        : (await ctx.prisma.season.findFirst({ where: { isActive: true } }))
          ?? (await ctx.prisma.season.findFirst({ orderBy: { year: 'desc' } }));

      if (!season) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No seasons found' });
      }

      const [allocations, waitlist] = await Promise.all([
        ctx.prisma.ticket.findMany({
          where: { seasonId: season.id },
          include: {
            member: { select: { id: true, name: true, email: true, playaName: true } },
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        }),
        ctx.prisma.waitlistEntry.findMany({
          where: { seasonId: season.id, fulfilledAt: null },
          include: {
            member: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        }),
      ]);

      // Status counts for the filter chips
      const counts: Record<string, number> = {
        INVITED: 0,
        CONTACTED: 0,
        PURCHASED_CONFIRMED: 0,
        VEHICLE_PASS_CONFIRMED: 0,
        REMOVED: 0,
        GOT_OUTSIDE: 0,
      };
      for (const a of allocations) counts[a.status] = (counts[a.status] ?? 0) + 1;

      return {
        season: { id: season.id, year: season.year, name: season.name },
        allocations,
        waitlist,
        counts: {
          ...counts,
          waitlist: waitlist.length,
          total: allocations.length,
        },
      };
    }),

  /**
   * Add or update a single DGS allocation. If an existing row for the same
   * (seasonId, lowercased email) is found, it's updated; otherwise created.
   */
  upsertAllocation: leadProcedure
    .input(
      z.object({
        seasonYear: z.number().int(),
        name: z.string().min(1).max(200),
        email: z.string().email().max(255).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
        quantity: z.number().int().min(0).max(20).optional().default(1),
        vehiclePass: z.boolean().optional().default(false),
        notes: z.string().max(2000).optional().nullable(),
        memberId: z.string().uuid().optional().nullable(),
        source: ticketSourceEnum.optional().default('DGS_DIRECT'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const season = await seasonByYear(ctx.prisma, input.seasonYear);
      const normalizedEmail = input.email?.toLowerCase().trim() || null;

      // Resolve memberId if not provided
      let memberId = input.memberId ?? null;
      if (!memberId) {
        const m = await resolveMember(ctx.prisma, normalizedEmail, input.name);
        memberId = m?.id ?? null;
      }

      // Dedupe key: (seasonId, memberId) when available, else (seasonId, placeholderEmail)
      let existing: { id: string; contactedAt: Date | null; purchasedAt: Date | null } | null = null;
      if (memberId) {
        existing = await ctx.prisma.ticket.findFirst({
          where: { seasonId: season.id, memberId },
          select: { id: true, contactedAt: true, purchasedAt: true },
        });
      }
      if (!existing && normalizedEmail) {
        existing = await ctx.prisma.ticket.findFirst({
          where: { seasonId: season.id, placeholderEmail: normalizedEmail },
          select: { id: true, contactedAt: true, purchasedAt: true },
        });
      }

      if (existing) {
        const updated = await ctx.prisma.ticket.update({
          where: { id: existing.id },
          data: {
            memberId,
            placeholderName: memberId ? null : input.name,
            placeholderEmail: memberId ? null : normalizedEmail,
            quantity: input.quantity,
            vehiclePass: input.vehiclePass,
            notes: input.notes ?? undefined,
            source: input.source,
          },
        });
        logger.info(`Ticket ${updated.id} updated by ${ctx.user.email}`);
        return updated;
      }

      const created = await ctx.prisma.ticket.create({
        data: {
          seasonId: season.id,
          memberId,
          placeholderName: memberId ? null : input.name,
          placeholderEmail: memberId ? null : normalizedEmail,
          quantity: input.quantity,
          vehiclePass: input.vehiclePass,
          notes: input.notes ?? undefined,
          status: 'INVITED',
          source: input.source,
          type: 'DGS',
        },
      });
      logger.info(`Ticket ${created.id} created by ${ctx.user.email}`);
      return created;
    }),

  /**
   * Transition a ticket through the DGS lifecycle. Sets the matching
   * timestamp and any implied boolean flag (e.g., PURCHASED_CONFIRMED also
   * sets purchaseConfirmed=true).
   */
  updateStatus: leadProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: ticketStatusEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.ticket.findUnique({
        where: { id: input.id },
        select: { id: true, contactedAt: true, purchasedAt: true },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });
      }

      const updated = await ctx.prisma.ticket.update({
        where: { id: input.id },
        data: dataForStatus(input.status, existing),
      });
      logger.info(`Ticket ${input.id} → ${input.status} by ${ctx.user.email}`);
      return updated;
    }),

  /**
   * Patch arbitrary editable fields on a ticket (notes, quantity, vehiclePass).
   * Status changes go through updateStatus; this is for inline corrections.
   */
  updateAllocation: leadProcedure
    .input(z.object({
      id: z.string().uuid(),
      quantity: z.number().int().min(0).max(20).optional(),
      vehiclePass: z.boolean().optional(),
      notes: z.string().max(2000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const data: Prisma.TicketUpdateInput = {};
      if (rest.quantity !== undefined) data.quantity = rest.quantity;
      if (rest.vehiclePass !== undefined) data.vehiclePass = rest.vehiclePass;
      if (rest.notes !== undefined) data.notes = rest.notes;

      const updated = await ctx.prisma.ticket.update({ where: { id }, data });
      return updated;
    }),

  /**
   * Soft-remove an allocation (status=REMOVED, removedAt=now). Optional reason
   * is appended to the notes field.
   */
  removeAllocation: leadProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.ticket.findUnique({
        where: { id: input.id },
        select: { id: true, notes: true },
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Ticket not found' });
      }
      const newNotes = input.reason
        ? `${existing.notes ? existing.notes + '\n' : ''}Removed: ${input.reason}`
        : existing.notes;
      const updated = await ctx.prisma.ticket.update({
        where: { id: input.id },
        data: {
          status: 'REMOVED',
          removedAt: new Date(),
          notes: newNotes ?? undefined,
        },
      });
      logger.info(`Ticket ${input.id} removed by ${ctx.user.email}${input.reason ? ` (${input.reason})` : ''}`);
      return updated;
    }),

  /**
   * Bulk-paste from spreadsheet. Idempotent per (seasonId, lowercased email).
   * Returns counts: created / updated / skipped (no name & no email).
   */
  bulkAddFromCsv: leadProcedure
    .input(z.object({
      seasonYear: z.number().int(),
      rows: z.array(z.object({
        name: z.string().max(200),
        email: z.string().max(255).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
        quantity: z.number().int().min(0).max(20).optional(),
        vehiclePass: z.boolean().optional(),
        notes: z.string().max(2000).optional().nullable(),
      })).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const season = await seasonByYear(ctx.prisma, input.seasonYear);

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of input.rows) {
        const name = row.name?.trim();
        if (!name || name.length < 2) { skipped++; continue; }

        const normalizedEmail = row.email?.toLowerCase().trim() || null;
        const member = await resolveMember(ctx.prisma, normalizedEmail, name);

        // Dedupe
        let existing: { id: string } | null = null;
        if (member) {
          existing = await ctx.prisma.ticket.findFirst({
            where: { seasonId: season.id, memberId: member.id },
            select: { id: true },
          });
        }
        if (!existing && normalizedEmail) {
          existing = await ctx.prisma.ticket.findFirst({
            where: { seasonId: season.id, placeholderEmail: normalizedEmail },
            select: { id: true },
          });
        }

        const baseData = {
          quantity: row.quantity ?? 1,
          vehiclePass: row.vehiclePass ?? false,
          notes: row.notes ?? undefined,
        };

        if (existing) {
          await ctx.prisma.ticket.update({
            where: { id: existing.id },
            data: {
              ...baseData,
              memberId: member?.id ?? null,
              placeholderName: member ? null : name,
              placeholderEmail: member ? null : normalizedEmail,
            },
          });
          updated++;
        } else {
          await ctx.prisma.ticket.create({
            data: {
              seasonId: season.id,
              memberId: member?.id ?? null,
              placeholderName: member ? null : name,
              placeholderEmail: member ? null : normalizedEmail,
              ...baseData,
              status: 'INVITED',
              source: 'DGS_DIRECT',
              type: 'DGS',
            },
          });
          created++;
        }
      }

      logger.info(`Bulk DGS import for season ${season.year}: ${created} created, ${updated} updated, ${skipped} skipped (by ${ctx.user.email})`);
      return { created, updated, skipped };
    }),

  /**
   * Add a person to the season's waitlist. Position defaults to (max + 1)
   * within the same season.
   */
  addToWaitlist: leadProcedure
    .input(z.object({
      seasonYear: z.number().int(),
      name: z.string().min(1).max(200),
      email: z.string().email().max(255).optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      quantityRequested: z.number().int().min(1).max(20).optional().default(1),
      notes: z.string().max(2000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const season = await seasonByYear(ctx.prisma, input.seasonYear);
      const normalizedEmail = input.email?.toLowerCase().trim() || null;
      const member = await resolveMember(ctx.prisma, normalizedEmail, input.name);

      const lastPos = await ctx.prisma.waitlistEntry.findFirst({
        where: { seasonId: season.id },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const created = await ctx.prisma.waitlistEntry.create({
        data: {
          seasonId: season.id,
          memberId: member?.id ?? null,
          name: input.name.trim(),
          email: normalizedEmail,
          phone: input.phone ?? undefined,
          quantityRequested: input.quantityRequested,
          notes: input.notes ?? undefined,
          position: (lastPos?.position ?? 0) + 1,
        },
      });
      logger.info(`Waitlist entry ${created.id} added by ${ctx.user.email}`);
      return created;
    }),

  /**
   * Move a waitlist entry into the allocations table. Creates a Ticket row
   * with source=WAITLIST_FULFILLED, status=INVITED, and marks the waitlist
   * entry fulfilled.
   */
  fulfillFromWaitlist: leadProcedure
    .input(z.object({ waitlistId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.waitlistEntry.findUnique({
        where: { id: input.waitlistId },
      });
      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Waitlist entry not found' });
      }
      if (entry.fulfilledAt) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Already fulfilled' });
      }

      // Resolve member fresh (may have been added since the waitlist entry was created)
      const member = entry.memberId
        ? { id: entry.memberId }
        : (await resolveMember(ctx.prisma, entry.email, entry.name));

      // Check if there's already an allocation for this person in the same season
      let existing: { id: string } | null = null;
      if (member?.id) {
        existing = await ctx.prisma.ticket.findFirst({
          where: { seasonId: entry.seasonId, memberId: member.id },
          select: { id: true },
        });
      }
      if (!existing && entry.email) {
        existing = await ctx.prisma.ticket.findFirst({
          where: { seasonId: entry.seasonId, placeholderEmail: entry.email },
          select: { id: true },
        });
      }

      let ticketId: string;
      if (existing) {
        // Convert existing record to WAITLIST_FULFILLED + INVITED
        const updated = await ctx.prisma.ticket.update({
          where: { id: existing.id },
          data: {
            status: 'INVITED',
            source: 'WAITLIST_FULFILLED',
            fulfilledAt: new Date(),
            removedAt: null,
            quantity: entry.quantityRequested,
          },
        });
        ticketId = updated.id;
      } else {
        const created = await ctx.prisma.ticket.create({
          data: {
            seasonId: entry.seasonId,
            memberId: member?.id ?? null,
            placeholderName: member?.id ? null : entry.name,
            placeholderEmail: member?.id ? null : entry.email,
            quantity: entry.quantityRequested,
            notes: entry.notes ?? undefined,
            status: 'INVITED',
            source: 'WAITLIST_FULFILLED',
            fulfilledAt: new Date(),
            type: 'DGS',
          },
        });
        ticketId = created.id;
      }

      await ctx.prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { fulfilledAt: new Date(), fulfilledTicketId: ticketId },
      });

      logger.info(`Waitlist ${entry.id} fulfilled → ticket ${ticketId} by ${ctx.user.email}`);
      return { ticketId };
    }),

  /** Remove a waitlist entry without fulfilling it. */
  removeWaitlistEntry: leadProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.waitlistEntry.findUnique({ where: { id: input.id } });
      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Waitlist entry not found' });
      }
      await ctx.prisma.waitlistEntry.delete({ where: { id: input.id } });
      logger.info(`Waitlist ${input.id} removed by ${ctx.user.email}`);
      return { success: true };
    }),
});
