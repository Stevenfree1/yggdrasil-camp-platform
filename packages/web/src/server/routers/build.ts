import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { router, leadProcedure } from '../trpc';
import logger from '../lib/logger';
import { resolveSeasonId, seasonRef } from '../lib/season';

// ─── router ──────────────────────────────────────────────────────────────

export const buildRouter = router({
  /** List all build days for a season with assignments grouped by day. */
  list: leadProcedure
    .input(seasonRef.optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);

      const buildDays = await ctx.prisma.buildDay.findMany({
        where: { seasonId },
        orderBy: [{ date: 'asc' }, { name: 'asc' }],
        include: {
          assignments: {
            include: {
              seasonMember: {
                include: {
                  member: {
                    select: { id: true, name: true, email: true, playaName: true },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return {
        seasonId,
        buildDays: buildDays.map((d) => ({
          id: d.id,
          date: d.date,
          name: d.name,
          notes: d.notes,
          assignmentCount: d.assignments.length,
          assignments: d.assignments.map((a) => ({
            id: a.id,
            seasonMemberId: a.seasonMemberId,
            memberId: a.seasonMember.member.id,
            name: a.seasonMember.member.name,
            email: a.seasonMember.member.email,
            playaName: a.seasonMember.member.playaName,
            wapTicketId: a.wapTicketId,
            team: a.team,
            notes: a.notes,
          })),
        })),
      };
    }),

  /** Create or update a build day. */
  upsertDay: leadProcedure
    .input(z.object({
      id: z.string().uuid().optional(),
      seasonId: z.string().uuid().optional(),
      seasonYear: z.number().int().min(2014).max(2100).optional(),
      date: z.string().datetime(),
      name: z.string().min(1).max(120),
      notes: z.string().max(2000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const existing = await ctx.prisma.buildDay.findUnique({ where: { id: input.id } });
        if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Build day not found' });

        const updated = await ctx.prisma.buildDay.update({
          where: { id: input.id },
          data: {
            date: new Date(input.date),
            name: input.name,
            notes: input.notes ?? null,
          },
        });
        logger.info(`Build day updated: "${updated.name}" by ${ctx.user.email}`);
        return updated;
      }

      const seasonId = await resolveSeasonId(ctx.prisma, input);

      const created = await ctx.prisma.buildDay.create({
        data: {
          seasonId,
          date: new Date(input.date),
          name: input.name,
          notes: input.notes ?? null,
        },
      });
      logger.info(`Build day created: "${created.name}" by ${ctx.user.email}`);
      return created;
    }),

  /** Delete a build day (cascades to its assignments). */
  deleteDay: leadProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.buildDay.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, _count: { select: { assignments: true } } },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Build day not found' });

      await ctx.prisma.buildDay.delete({ where: { id: input.id } });
      logger.info(
        `Build day deleted: "${existing.name}" (${existing._count.assignments} assignments) by ${ctx.user.email}`,
      );
      return { success: true };
    }),

  /** Assign a season member to a build day. */
  assignMember: leadProcedure
    .input(z.object({
      buildDayId: z.string().uuid(),
      seasonMemberId: z.string().uuid(),
      wapTicketId: z.string().max(120).nullable().optional(),
      team: z.string().max(120).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const day = await ctx.prisma.buildDay.findUnique({
        where: { id: input.buildDayId },
        select: { id: true, seasonId: true, name: true },
      });
      if (!day) throw new TRPCError({ code: 'NOT_FOUND', message: 'Build day not found' });

      const sm = await ctx.prisma.seasonMember.findUnique({
        where: { id: input.seasonMemberId },
        include: { member: { select: { name: true } } },
      });
      if (!sm) throw new TRPCError({ code: 'NOT_FOUND', message: 'Season member not found' });
      if (sm.seasonId !== day.seasonId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Member is not in the same season as the build day' });
      }

      const existing = await ctx.prisma.buildAssignment.findUnique({
        where: {
          buildDayId_seasonMemberId: {
            buildDayId: input.buildDayId,
            seasonMemberId: input.seasonMemberId,
          },
        },
      });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'This member is already assigned to this build day' });
      }

      const created = await ctx.prisma.buildAssignment.create({
        data: {
          buildDayId: input.buildDayId,
          seasonMemberId: input.seasonMemberId,
          wapTicketId: input.wapTicketId ?? null,
          team: input.team ?? null,
          notes: input.notes ?? null,
        },
      });

      // Mark the season member as build crew (idempotent)
      if (!sm.buildCrew) {
        await ctx.prisma.seasonMember.update({
          where: { id: input.seasonMemberId },
          data: { buildCrew: true },
        });
      }

      logger.info(
        `Build assignment: ${sm.member.name} → "${day.name}" by ${ctx.user.email}`,
      );
      return created;
    }),

  /** Update an existing assignment (team/notes/ticket). */
  updateAssignment: leadProcedure
    .input(z.object({
      id: z.string().uuid(),
      wapTicketId: z.string().max(120).nullable().optional(),
      team: z.string().max(120).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.buildAssignment.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });

      const data: Prisma.BuildAssignmentUpdateInput = {};
      if (input.wapTicketId !== undefined) data.wapTicketId = input.wapTicketId;
      if (input.team !== undefined) data.team = input.team;
      if (input.notes !== undefined) data.notes = input.notes;

      return ctx.prisma.buildAssignment.update({ where: { id: input.id }, data });
    }),

  /** Remove a member from a build day. */
  unassign: leadProcedure
    .input(z.object({ assignmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.buildAssignment.findUnique({
        where: { id: input.assignmentId },
        include: {
          seasonMember: { include: { member: { select: { name: true } } } },
          buildDay: { select: { name: true } },
        },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });

      await ctx.prisma.buildAssignment.delete({ where: { id: input.assignmentId } });
      logger.info(
        `Build unassign: ${existing.seasonMember.member.name} from "${existing.buildDay.name}" by ${ctx.user.email}`,
      );
      return { success: true };
    }),

  /** Per-day + per-team headcount summary, flags days with low coverage. */
  summary: leadProcedure
    .input(seasonRef.optional().default({}))
    .query(async ({ ctx, input }) => {
      const seasonId = await resolveSeasonId(ctx.prisma, input);
      const MIN_PER_DAY = 5;

      const buildDays = await ctx.prisma.buildDay.findMany({
        where: { seasonId },
        orderBy: { date: 'asc' },
        include: { assignments: { select: { team: true } } },
      });

      const days = buildDays.map((d) => {
        const teamCounts: Record<string, number> = {};
        for (const a of d.assignments) {
          const key = a.team || '(unassigned)';
          teamCounts[key] = (teamCounts[key] || 0) + 1;
        }
        return {
          id: d.id,
          name: d.name,
          date: d.date,
          headcount: d.assignments.length,
          isUnderfilled: d.assignments.length < MIN_PER_DAY,
          teamCounts,
        };
      });

      const totalAssignments = days.reduce((acc, d) => acc + d.headcount, 0);
      const teamTotals: Record<string, number> = {};
      for (const d of days) {
        for (const [team, count] of Object.entries(d.teamCounts)) {
          teamTotals[team] = (teamTotals[team] || 0) + count;
        }
      }

      return {
        seasonId,
        totalAssignments,
        dayCount: days.length,
        underfilledCount: days.filter((d) => d.isUnderfilled).length,
        days,
        teamTotals,
      };
    }),
});
