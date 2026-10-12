import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { router, leadProcedure } from '../trpc';
import logger from '../lib/logger';
import { resolveSeasonId, seasonRef } from '../lib/season';

/** Group key for departureDate: YYYY-MM-DD or null. */
function dayKey(d: Date | null): string {
  if (!d) return 'unscheduled';
  return d.toISOString().slice(0, 10);
}

// ─── router ──────────────────────────────────────────────────────────────

export const strikeRouter = router({
  /** List strike assignments for a season, grouped by departureDate. */
  list: leadProcedure
    .input(seasonRef.optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);

      const assignments = await ctx.prisma.strikeAssignment.findMany({
        where: { seasonId },
        include: {
          seasonMember: {
            include: {
              member: {
                select: { id: true, name: true, email: true, playaName: true },
              },
            },
          },
        },
        orderBy: [{ departureDate: 'asc' }, { createdAt: 'asc' }],
      });

      const groups = new Map<
        string,
        {
          key: string;
          date: Date | null;
          assignments: typeof assignments;
        }
      >();
      for (const a of assignments) {
        const key = dayKey(a.departureDate);
        if (!groups.has(key)) {
          groups.set(key, { key, date: a.departureDate, assignments: [] });
        }
        groups.get(key)!.assignments.push(a);
      }

      const strikeDays = Array.from(groups.values()).map((g) => ({
        key: g.key,
        date: g.date,
        label: g.date
          ? g.date.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })
          : 'Unscheduled',
        assignmentCount: g.assignments.length,
        assignments: g.assignments.map((a) => ({
          id: a.id,
          seasonMemberId: a.seasonMemberId,
          memberId: a.seasonMember.member.id,
          name: a.seasonMember.member.name,
          email: a.seasonMember.member.email,
          playaName: a.seasonMember.member.playaName,
          team: a.team,
          notes: a.notes,
        })),
      }));

      return { seasonId, strikeDays };
    }),

  /** Assign a season member to a strike day (departureDate). */
  assignMember: leadProcedure
    .input(z.object({
      seasonId: z.string().uuid().optional(),
      seasonYear: z.number().int().min(2014).max(2100).optional(),
      seasonMemberId: z.string().uuid(),
      departureDate: z.string().datetime().nullable().optional(),
      team: z.string().max(120).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);

      const sm = await ctx.prisma.seasonMember.findUnique({
        where: { id: input.seasonMemberId },
        include: { member: { select: { name: true } } },
      });
      if (!sm) throw new TRPCError({ code: 'NOT_FOUND', message: 'Season member not found' });
      if (sm.seasonId !== seasonId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Member is not in this season' });
      }

      // StrikeAssignment has unique on seasonMemberId — upsert if exists
      const existing = await ctx.prisma.strikeAssignment.findUnique({
        where: { seasonMemberId: input.seasonMemberId },
      });

      const departureDate = input.departureDate ? new Date(input.departureDate) : null;

      let result;
      if (existing) {
        result = await ctx.prisma.strikeAssignment.update({
          where: { id: existing.id },
          data: {
            departureDate,
            team: input.team ?? existing.team,
            notes: input.notes ?? existing.notes,
          },
        });
        logger.info(`Strike reassign: ${sm.member.name} → ${dayKey(departureDate)} by ${ctx.user.email}`);
      } else {
        result = await ctx.prisma.strikeAssignment.create({
          data: {
            seasonId,
            seasonMemberId: input.seasonMemberId,
            departureDate,
            team: input.team ?? null,
            notes: input.notes ?? null,
          },
        });
        logger.info(`Strike assign: ${sm.member.name} → ${dayKey(departureDate)} by ${ctx.user.email}`);
      }

      // Flag as strike crew
      if (!sm.strikeCrew) {
        await ctx.prisma.seasonMember.update({
          where: { id: input.seasonMemberId },
          data: { strikeCrew: true },
        });
      }

      return result;
    }),

  /** Update an existing strike assignment. */
  updateAssignment: leadProcedure
    .input(z.object({
      id: z.string().uuid(),
      departureDate: z.string().datetime().nullable().optional(),
      team: z.string().max(120).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.strikeAssignment.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });

      const data: Prisma.StrikeAssignmentUpdateInput = {};
      if (input.departureDate !== undefined) {
        data.departureDate = input.departureDate ? new Date(input.departureDate) : null;
      }
      if (input.team !== undefined) data.team = input.team;
      if (input.notes !== undefined) data.notes = input.notes;

      return ctx.prisma.strikeAssignment.update({ where: { id: input.id }, data });
    }),

  /** Remove a member from strike. */
  unassign: leadProcedure
    .input(z.object({ assignmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.strikeAssignment.findUnique({
        where: { id: input.assignmentId },
        include: { seasonMember: { include: { member: { select: { name: true } } } } },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });

      await ctx.prisma.strikeAssignment.delete({ where: { id: input.assignmentId } });
      logger.info(`Strike unassign: ${existing.seasonMember.member.name} by ${ctx.user.email}`);
      return { success: true };
    }),

  /** Per-day + per-team headcount. */
  summary: leadProcedure
    .input(seasonRef.optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);
      const MIN_PER_DAY = 3;

      const assignments = await ctx.prisma.strikeAssignment.findMany({
        where: { seasonId },
        select: { departureDate: true, team: true },
      });

      const dayMap = new Map<string, { date: Date | null; headcount: number; teamCounts: Record<string, number> }>();
      for (const a of assignments) {
        const key = dayKey(a.departureDate);
        if (!dayMap.has(key)) {
          dayMap.set(key, { date: a.departureDate, headcount: 0, teamCounts: {} });
        }
        const entry = dayMap.get(key)!;
        entry.headcount++;
        const team = a.team || '(unassigned)';
        entry.teamCounts[team] = (entry.teamCounts[team] || 0) + 1;
      }

      const days = Array.from(dayMap.entries())
        .map(([key, v]) => ({
          key,
          date: v.date,
          headcount: v.headcount,
          isUnderfilled: v.headcount < MIN_PER_DAY,
          teamCounts: v.teamCounts,
        }))
        .sort((a, b) => {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.getTime() - b.date.getTime();
        });

      const teamTotals: Record<string, number> = {};
      for (const d of days) {
        for (const [team, count] of Object.entries(d.teamCounts)) {
          teamTotals[team] = (teamTotals[team] || 0) + count;
        }
      }

      return {
        seasonId,
        totalAssignments: assignments.length,
        dayCount: days.length,
        underfilledCount: days.filter((d) => d.isUnderfilled).length,
        days,
        teamTotals,
      };
    }),
});
