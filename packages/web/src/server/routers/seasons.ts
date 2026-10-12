import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { router, memberProcedure, managerProcedure, leadProcedure } from '../trpc';
import logger from '../lib/logger';

export const seasonsRouter = router({
  list: memberProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.season.findMany({
        orderBy: { year: 'desc' },
        include: { _count: { select: { seasonMembers: true } } },
      });
    }),

  getCurrent: memberProcedure
    .query(async ({ ctx }) => {
      const season = await ctx.prisma.season.findFirst({
        where: { isActive: true },
      });

      if (!season) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
      }

      return season;
    }),

  create: leadProcedure
    .input(z.object({
      year: z.number().int().min(2020).max(2100),
      name: z.string().min(1),
      duesAmount: z.number().int().min(0),
      gridFee30amp: z.number().int().min(0),
      gridFee50amp: z.number().int().min(0),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      buildStartDate: z.string().datetime().optional(),
      strikeEndDate: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.season.create({
        data: {
          year: input.year,
          name: input.name,
          duesAmount: input.duesAmount,
          gridFee30amp: input.gridFee30amp,
          gridFee50amp: input.gridFee50amp,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          buildStartDate: input.buildStartDate ? new Date(input.buildStartDate) : null,
          strikeEndDate: input.strikeEndDate ? new Date(input.strikeEndDate) : null,
        },
      });
    }),

  update: leadProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      duesAmount: z.number().int().min(0).optional(),
      gridFee30amp: z.number().int().min(0).optional(),
      gridFee50amp: z.number().int().min(0).optional(),
      startDate: z.string().datetime().nullable().optional(),
      endDate: z.string().datetime().nullable().optional(),
      buildStartDate: z.string().datetime().nullable().optional(),
      strikeEndDate: z.string().datetime().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, startDate, endDate, buildStartDate, strikeEndDate, ...rest } = input;

      const existing = await ctx.prisma.season.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
      }

      const data: Prisma.SeasonUpdateInput = { ...rest };
      if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
      if (buildStartDate !== undefined) data.buildStartDate = buildStartDate ? new Date(buildStartDate) : null;
      if (strikeEndDate !== undefined) data.strikeEndDate = strikeEndDate ? new Date(strikeEndDate) : null;

      logger.info(`Season ${existing.year} updated by ${ctx.user.email}`);

      return ctx.prisma.season.update({
        where: { id },
        data,
      });
    }),

  activate: leadProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify target season exists before deactivating all others
      const target = await ctx.prisma.season.findUnique({ where: { id: input.id } });
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });
      }

      // Deactivate all seasons, then activate the target (transactional)
      return ctx.prisma.$transaction(async (tx) => {
        await tx.season.updateMany({
          data: { isActive: false },
        });
        return tx.season.update({
          where: { id: input.id },
          data: { isActive: true },
        });
      });
    }),

  rollover: leadProcedure
    .input(z.object({
      fromSeasonId: z.string().uuid(),
      year: z.number().int().min(2020).max(2100),
      name: z.string().min(1),
      duesAmount: z.number().int().min(0),
      gridFee30amp: z.number().int().min(0),
      gridFee50amp: z.number().int().min(0),
      memberFilter: z.enum(['all_active', 'confirmed_only', 'custom']).default('all_active'),
      memberIds: z.array(z.string().uuid()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verify source season exists
      const sourceSeason = await ctx.prisma.season.findUnique({
        where: { id: input.fromSeasonId },
      });
      if (!sourceSeason) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Source season not found' });
      }

      // 2. Verify target year doesn't already exist
      const existingSeason = await ctx.prisma.season.findUnique({
        where: { year: input.year },
      });
      if (existingSeason) {
        throw new TRPCError({ code: 'CONFLICT', message: `A season for year ${input.year} already exists` });
      }

      // 3. Create the new season (NOT active by default)
      const newSeason = await ctx.prisma.season.create({
        data: {
          year: input.year,
          name: input.name,
          duesAmount: input.duesAmount,
          gridFee30amp: input.gridFee30amp,
          gridFee50amp: input.gridFee50amp,
        },
      });

      // 4. Query members from source season based on filter
      let whereClause: any = { seasonId: input.fromSeasonId };

      if (input.memberFilter === 'all_active') {
        whereClause.status = { not: 'CANCELLED' };
      } else if (input.memberFilter === 'confirmed_only') {
        whereClause.status = 'CONFIRMED';
      } else if (input.memberFilter === 'custom') {
        if (!input.memberIds || input.memberIds.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'memberIds required when memberFilter is "custom"' });
        }
        whereClause.memberId = { in: input.memberIds };
      }

      const sourceMembers = await ctx.prisma.seasonMember.findMany({
        where: whereClause,
        select: { memberId: true },
      });

      // 5. Bulk create SeasonMember enrollments for the new season
      const enrollmentData = sourceMembers.map((sm) => ({
        seasonId: newSeason.id,
        memberId: sm.memberId,
        status: 'INTERESTED' as const,
      }));

      await ctx.prisma.seasonMember.createMany({
        data: enrollmentData,
        skipDuplicates: true,
      });

      // 6. Create audit log entry
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id,
          action: 'SEASON_ROLLOVER',
          entityType: 'Season',
          entityId: newSeason.id,
          details: {
            fromSeasonId: input.fromSeasonId,
            fromYear: sourceSeason.year,
            toYear: input.year,
            memberFilter: input.memberFilter,
            membersEnrolled: sourceMembers.length,
          },
        },
      });

      // 7. Return result
      return {
        season: newSeason,
        membersEnrolled: sourceMembers.length,
      };
    }),

  getStats: managerProcedure
    .input(z.object({ seasonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [statusCounts, housingCounts, payments] = await Promise.all([
        ctx.prisma.seasonMember.groupBy({
          by: ['status'],
          where: { seasonId: input.seasonId },
          _count: true,
        }),
        ctx.prisma.seasonMember.groupBy({
          by: ['housingType'],
          where: { seasonId: input.seasonId, housingType: { not: null } },
          _count: true,
        }),
        ctx.prisma.payment.aggregate({
          where: { seasonMember: { seasonId: input.seasonId } },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      const membersByStatus: Record<string, number> = {};
      for (const s of statusCounts) {
        membersByStatus[s.status] = s._count;
      }

      const housingBreakdown: Record<string, number> = {};
      for (const h of housingCounts) {
        if (h.housingType) housingBreakdown[h.housingType] = h._count;
      }

      return {
        membersByStatus,
        housingBreakdown,
        totalMembers: Object.values(membersByStatus).reduce((a, b) => a + b, 0),
        totalCollected: payments._sum.amount || 0,
        totalPayments: payments._count,
      };
    }),
});
