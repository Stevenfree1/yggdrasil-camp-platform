import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, memberProcedure, scopedProcedure } from '../trpc';
import logger from '../lib/logger';
import { resolveSeasonId, seasonRef } from '../lib/season';

/**
 * Shift scheduling: blocks of work, named slots inside them, and one instance
 * per slot per day.
 *
 * An instance is a single seat — the legacy spreadsheet held exactly one name per cell
 * — so there is no volunteer count anywhere. A missing instance means the block
 * does not run that day; an instance with a null seasonMemberId is an open cell.
 *
 * Deliberately separate from `Shift` / `ShiftAssignment`, which events.ts owns.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Date-only values are stored at noon UTC so they cannot shift timezone. */
function dateOnly(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const blockInclude = {
  slots: {
    orderBy: [{ sortOrder: 'asc' as const }, { label: 'asc' as const }],
    include: {
      instances: {
        orderBy: { date: 'asc' as const },
        include: {
          seasonMember: {
            include: { member: { select: { id: true, name: true, playaName: true } } },
          },
        },
      },
    },
  },
};

type BlockWithSlots = {
  slots: { instances: { date: Date }[] }[];
};

/** The date columns are whatever the instances actually span. */
function datesFrom(blocks: BlockWithSlots[]): string[] {
  return Array.from(
    new Set(
      blocks.flatMap((b) =>
        b.slots.flatMap((s) => s.instances.map((i) => i.date.toISOString().slice(0, 10))),
      ),
    ),
  ).sort();
}

/**
 * Explains why this member cannot take the cell, or null when they are free.
 * Two shifts on the same day may not overlap in time.
 */
async function findOverlap(
  prisma: { shiftInstance: { findMany: Function } },
  seasonMemberId: string,
  instance: { id: string; date: Date; slot: { block: { startTime: string; endTime: string } } },
): Promise<string | null> {
  const sameDay = await prisma.shiftInstance.findMany({
    where: { seasonMemberId, date: instance.date, NOT: { id: instance.id } },
    include: { slot: { include: { block: true } } },
  });
  const start = toMinutes(instance.slot.block.startTime);
  const end = toMinutes(instance.slot.block.endTime);
  for (const other of sameDay as { slot: { block: { name: string; startTime: string; endTime: string } } }[]) {
    const os = toMinutes(other.slot.block.startTime);
    const oe = toMinutes(other.slot.block.endTime);
    if (start < oe && os < end) {
      return `Already on "${other.slot.block.name}" (${other.slot.block.startTime}–${other.slot.block.endTime}) that day.`;
    }
  }
  return null;
}

export const shiftsRouter = router({
  // ─── admin ─────────────────────────────────────────────────────────────

  /** The whole grid for a season: blocks, their slots, and every cell. */
  grid: scopedProcedure('SHIFTS', 'LEAD')
    .input(seasonRef.optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);
      const season = await ctx.prisma.season.findUniqueOrThrow({
        where: { id: seasonId },
        select: { id: true, year: true, shiftSignupOpen: true, minShiftsPerMember: true },
      });
      const blocks = await ctx.prisma.shiftBlock.findMany({
        where: { seasonId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: blockInclude,
      });
      return { season, dates: datesFrom(blocks), blocks };
    }),

  /** The gate. Members cannot claim or release until this is on. */
  setSignupOpen: scopedProcedure('SHIFTS', 'LEAD')
    .input(seasonRef.extend({ open: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);
      const updated = await ctx.prisma.season.update({
        where: { id: seasonId },
        data: { shiftSignupOpen: input.open },
        select: { id: true, year: true, shiftSignupOpen: true },
      });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: input.open ? 'SHIFT_SIGNUP_OPENED' : 'SHIFT_SIGNUP_CLOSED',
          entityType: 'Season',
          entityId: seasonId,
          details: { by: ctx.user.email },
        },
      });
      logger.security(
        `Shift signup ${input.open ? 'opened' : 'closed'} for ${updated.year} by ${ctx.user.email}`,
      );
      return updated;
    }),

  upsertBlock: scopedProcedure('SHIFTS', 'LEAD')
    .input(
      seasonRef.extend({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        startTime: z.string().regex(HHMM, 'Use HH:MM'),
        endTime: z.string().regex(HHMM, 'Use HH:MM'),
        notes: z.string().trim().max(1000).nullable().optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (toMinutes(input.endTime) <= toMinutes(input.startTime)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'End time must be after start time' });
      }
      const seasonId = await resolveSeasonId(ctx.prisma, input);
      const data = {
        seasonId,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        notes: input.notes ?? null,
        sortOrder: input.sortOrder ?? 0,
      };
      const block = input.id
        ? await ctx.prisma.shiftBlock.update({ where: { id: input.id }, data })
        : await ctx.prisma.shiftBlock.create({ data });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: input.id ? 'SHIFT_BLOCK_UPDATED' : 'SHIFT_BLOCK_CREATED',
          entityType: 'ShiftBlock',
          entityId: block.id,
          details: { name: block.name },
        },
      });
      return block;
    }),

  deleteBlock: scopedProcedure('SHIFTS', 'LEAD')
    .input(z.object({ id: z.string().uuid(), confirmDropOccupants: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const block = await ctx.prisma.shiftBlock.findUnique({
        where: { id: input.id },
        include: { slots: { include: { instances: { where: { NOT: { seasonMemberId: null } } } } } },
      });
      if (!block) throw new TRPCError({ code: 'NOT_FOUND', message: 'Block not found' });

      const held = block.slots.reduce((n, s) => n + s.instances.length, 0);
      if (held > 0 && !input.confirmDropOccupants) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${held} filled shift${held === 1 ? '' : 's'} would be removed. Confirm to continue.`,
        });
      }

      await ctx.prisma.shiftBlock.delete({ where: { id: input.id } });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'SHIFT_BLOCK_DELETED',
          entityType: 'ShiftBlock',
          entityId: block.id,
          details: { name: block.name, droppedAssignments: held },
        },
      });
      return { success: true, droppedAssignments: held };
    }),

  upsertSlot: scopedProcedure('SHIFTS', 'LEAD')
    .input(
      z.object({
        id: z.string().uuid().optional(),
        blockId: z.string().uuid(),
        label: z.string().trim().min(1).max(120),
        requirement: z.string().trim().max(300).nullable().optional(),
        sortOrder: z.number().int().min(0).max(999).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = {
        blockId: input.blockId,
        label: input.label,
        requirement: input.requirement ?? null,
        sortOrder: input.sortOrder ?? 0,
      };
      const slot = input.id
        ? await ctx.prisma.shiftSlot.update({ where: { id: input.id }, data })
        : await ctx.prisma.shiftSlot.create({ data });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: input.id ? 'SHIFT_SLOT_UPDATED' : 'SHIFT_SLOT_CREATED',
          entityType: 'ShiftSlot',
          entityId: slot.id,
          details: { label: slot.label },
        },
      });
      return slot;
    }),

  deleteSlot: scopedProcedure('SHIFTS', 'LEAD')
    .input(z.object({ id: z.string().uuid(), confirmDropOccupants: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const slot = await ctx.prisma.shiftSlot.findUnique({
        where: { id: input.id },
        include: {
          instances: {
            where: { NOT: { seasonMemberId: null } },
            include: { seasonMember: { include: { member: { select: { name: true } } } } },
          },
        },
      });
      if (!slot) throw new TRPCError({ code: 'NOT_FOUND', message: 'Slot not found' });

      // Nobody is silently dropped from a shift they believe they have.
      if (slot.instances.length > 0 && !input.confirmDropOccupants) {
        const names = slot.instances
          .map((i) => i.seasonMember?.member.name)
          .filter(Boolean)
          .join(', ');
        throw new TRPCError({
          code: 'CONFLICT',
          message: `This slot is filled by ${names}. Confirm to remove it anyway.`,
        });
      }

      await ctx.prisma.shiftSlot.delete({ where: { id: input.id } });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'SHIFT_SLOT_DELETED',
          entityType: 'ShiftSlot',
          entityId: slot.id,
          details: { label: slot.label, droppedAssignments: slot.instances.length },
        },
      });
      return { success: true, droppedAssignments: slot.instances.length };
    }),

  /**
   * Create cells for a block across the given dates. Additive — existing cells
   * are skipped, so regenerating never disturbs a filled one.
   */
  generateInstances: scopedProcedure('SHIFTS', 'LEAD')
    .input(
      z.object({
        blockId: z.string().uuid(),
        dates: z.array(z.string().regex(ISO_DATE)).min(1).max(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const block = await ctx.prisma.shiftBlock.findUnique({
        where: { id: input.blockId },
        include: { slots: true },
      });
      if (!block) throw new TRPCError({ code: 'NOT_FOUND', message: 'Block not found' });
      if (block.slots.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Add at least one slot first' });
      }

      const result = await ctx.prisma.shiftInstance.createMany({
        data: block.slots.flatMap((slot) =>
          input.dates.map((d) => ({ slotId: slot.id, date: dateOnly(d) })),
        ),
        skipDuplicates: true,
      });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'SHIFT_INSTANCES_GENERATED',
          entityType: 'ShiftBlock',
          entityId: block.id,
          details: { name: block.name, dates: input.dates, created: result.count },
        },
      });
      return { created: result.count };
    }),

  /** Remove a block's cells on given dates. Refuses to drop filled ones. */
  removeInstances: scopedProcedure('SHIFTS', 'LEAD')
    .input(
      z.object({
        blockId: z.string().uuid(),
        dates: z.array(z.string().regex(ISO_DATE)).min(1).max(60),
        confirmDropOccupants: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dates = input.dates.map(dateOnly);
      const slots = await ctx.prisma.shiftSlot.findMany({
        where: { blockId: input.blockId },
        select: { id: true },
      });
      const slotIds = slots.map((s) => s.id);
      const filled = await ctx.prisma.shiftInstance.count({
        where: { slotId: { in: slotIds }, date: { in: dates }, NOT: { seasonMemberId: null } },
      });
      if (filled > 0 && !input.confirmDropOccupants) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `${filled} of those cells are filled. Confirm to remove them anyway.`,
        });
      }
      const result = await ctx.prisma.shiftInstance.deleteMany({
        where: { slotId: { in: slotIds }, date: { in: dates } },
      });
      return { removed: result.count };
    }),

  /** Place someone in a cell, replacing whoever was there. */
  /**
   * The roster the assign picker searches.
   *
   * Deliberately not a reuse of `seasonMembers.list`: that one is
   * `managerProcedure` and returns every SeasonMember scalar — dues status and
   * note, housing, travel, grid power — plus member phone. A shifts admin needs
   * names to put in cells and nothing else, so this returns the five fields the
   * picker renders and is gated on the SHIFTS scope instead.
   *
   * Base is MANAGER because that is who could read this data before scopes
   * existed; the mutations below stay LEAD-based.
   */
  assignableMembers: scopedProcedure('SHIFTS', 'MANAGER')
    .input(seasonRef.extend({
      search: z.string().optional(),
      limit: z.number().min(1).max(500).optional().default(200),
    }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);
      const where: {
        seasonId: string;
        member?: { OR: Record<string, unknown>[] };
      } = { seasonId };
      if (input.search) {
        where.member = {
          OR: [
            { name: { contains: input.search, mode: 'insensitive' } },
            { playaName: { contains: input.search, mode: 'insensitive' } },
            { email: { contains: input.search, mode: 'insensitive' } },
          ],
        };
      }
      const seasonMembers = await ctx.prisma.seasonMember.findMany({
        where,
        select: {
          id: true,
          member: { select: { id: true, name: true, playaName: true, email: true } },
        },
        orderBy: { member: { name: 'asc' } },
        take: input.limit,
      });
      return { seasonMembers };
    }),

  assign: scopedProcedure('SHIFTS', 'LEAD')
    .input(z.object({ instanceId: z.string().uuid(), seasonMemberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.shiftInstance.findUnique({
        where: { id: input.instanceId },
        include: { slot: { include: { block: true } } },
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift cell not found' });

      const sm = await ctx.prisma.seasonMember.findUnique({
        where: { id: input.seasonMemberId },
        include: { member: { select: { name: true } } },
      });
      if (!sm) throw new TRPCError({ code: 'NOT_FOUND', message: 'Season member not found' });
      if (sm.seasonId !== instance.slot.block.seasonId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Member is not in this season' });
      }

      const clash = await findOverlap(ctx.prisma, input.seasonMemberId, instance);
      if (clash) throw new TRPCError({ code: 'CONFLICT', message: clash });

      const updated = await ctx.prisma.shiftInstance.update({
        where: { id: input.instanceId },
        data: {
          seasonMemberId: input.seasonMemberId,
          claimedAt: new Date(),
          assignedById: ctx.user.id,
        },
      });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'SHIFT_ASSIGNED',
          entityType: 'ShiftInstance',
          entityId: updated.id,
          details: {
            slot: instance.slot.label,
            block: instance.slot.block.name,
            member: sm.member.name,
          },
        },
      });
      return updated;
    }),

  clear: scopedProcedure('SHIFTS', 'LEAD')
    .input(z.object({ instanceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.shiftInstance.findUnique({
        where: { id: input.instanceId },
        include: {
          slot: { include: { block: true } },
          seasonMember: { include: { member: { select: { name: true } } } },
        },
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift cell not found' });

      const updated = await ctx.prisma.shiftInstance.update({
        where: { id: input.instanceId },
        data: { seasonMemberId: null, claimedAt: null, assignedById: null },
      });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'SHIFT_CLEARED',
          entityType: 'ShiftInstance',
          entityId: updated.id,
          details: {
            slot: instance.slot.label,
            block: instance.slot.block.name,
            was: instance.seasonMember?.member.name ?? null,
          },
        },
      });
      return updated;
    }),

  /** Members below the season minimum — the chase list. */
  understaffed: scopedProcedure('SHIFTS', 'LEAD')
    .input(seasonRef.optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);
      const season = await ctx.prisma.season.findUniqueOrThrow({
        where: { id: seasonId },
        select: { minShiftsPerMember: true },
      });
      const members = await ctx.prisma.seasonMember.findMany({
        where: { seasonId },
        include: {
          member: { select: { id: true, name: true, playaName: true, email: true } },
          shiftInstances: { select: { id: true } },
        },
      });
      const min = season.minShiftsPerMember;
      return {
        min,
        members: members
          .map((sm) => ({
            seasonMemberId: sm.id,
            memberId: sm.member.id,
            name: sm.member.name,
            playaName: sm.member.playaName,
            email: sm.member.email,
            count: sm.shiftInstances.length,
          }))
          .filter((m) => m.count < min)
          .sort((a, b) => a.count - b.count || a.name.localeCompare(b.name)),
      };
    }),

  // ─── member ────────────────────────────────────────────────────────────

  /** The same grid for a member, plus which cells are theirs. */
  myGrid: memberProcedure
    .input(seasonRef.optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);
      const season = await ctx.prisma.season.findUniqueOrThrow({
        where: { id: seasonId },
        select: { shiftSignupOpen: true, minShiftsPerMember: true },
      });
      const me = await ctx.prisma.seasonMember.findFirst({
        where: { seasonId, memberId: ctx.user.id },
        select: { id: true },
      });

      const blocks = await ctx.prisma.shiftBlock.findMany({
        where: { seasonId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: blockInclude,
      });

      const myCount = me
        ? blocks.reduce(
            (n, b) =>
              n +
              b.slots.reduce(
                (m, s) => m + s.instances.filter((i) => i.seasonMemberId === me.id).length,
                0,
              ),
            0,
          )
        : 0;

      return {
        signupOpen: season.shiftSignupOpen,
        min: season.minShiftsPerMember,
        myCount,
        mySeasonMemberId: me?.id ?? null,
        dates: datesFrom(blocks),
        blocks,
      };
    }),

  /** Claim an open cell. Race-safe, and refuses while the gate is closed. */
  claim: memberProcedure
    .input(z.object({ instanceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.shiftInstance.findUnique({
        where: { id: input.instanceId },
        include: { slot: { include: { block: { include: { season: true } } } } },
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found' });

      const season = instance.slot.block.season;
      // Server-side gate: hiding a button is not a gate.
      if (!season.shiftSignupOpen) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Shift signup is not open yet' });
      }

      const me = await ctx.prisma.seasonMember.findFirst({
        where: { seasonId: season.id, memberId: ctx.user.id },
        select: { id: true },
      });
      if (!me) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not enrolled in this season' });
      }

      const clash = await findOverlap(ctx.prisma, me.id, instance);
      if (clash) throw new TRPCError({ code: 'CONFLICT', message: clash });

      // Conditional update: first click wins, the loser is told rather than
      // silently overwriting whoever got there first.
      const result = await ctx.prisma.shiftInstance.updateMany({
        where: { id: input.instanceId, seasonMemberId: null },
        data: { seasonMemberId: me.id, claimedAt: new Date(), assignedById: null },
      });
      if (result.count === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Someone just took that shift — pick another.',
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'SHIFT_CLAIMED',
          entityType: 'ShiftInstance',
          entityId: instance.id,
          details: { slot: instance.slot.label, block: instance.slot.block.name },
        },
      });
      return { success: true };
    }),

  /** Release one of your own cells. */
  release: memberProcedure
    .input(z.object({ instanceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.shiftInstance.findUnique({
        where: { id: input.instanceId },
        include: { slot: { include: { block: { include: { season: true } } } } },
      });
      if (!instance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shift not found' });

      const season = instance.slot.block.season;
      if (!season.shiftSignupOpen) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Shift signup is not open' });
      }

      const me = await ctx.prisma.seasonMember.findFirst({
        where: { seasonId: season.id, memberId: ctx.user.id },
        select: { id: true },
      });
      if (!me || instance.seasonMemberId !== me.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'That is not your shift' });
      }

      await ctx.prisma.shiftInstance.update({
        where: { id: input.instanceId },
        data: { seasonMemberId: null, claimedAt: null, assignedById: null },
      });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'SHIFT_RELEASED',
          entityType: 'ShiftInstance',
          entityId: instance.id,
          details: { slot: instance.slot.label, block: instance.slot.block.name },
        },
      });
      return { success: true };
    }),
});
