import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Payment } from '@prisma/client';
import { router, memberProcedure, leadProcedure } from '../trpc';
import { getBrcWeather, FRESH_WINDOW_MS } from '../lib/brc-weather';

export const dashboardRouter = router({
  getAdminDashboard: leadProcedure
    .input(z.object({
      seasonId: z.string().uuid().optional(),
    }).optional().default({}))
    .query(async ({ ctx, input }) => {
      // Resolve season
      let seasonId = input.seasonId;
      if (!seasonId) {
        const active = await ctx.prisma.season.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        if (!active) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
        }
        seasonId = active.id;
      }

      const [
        season,
        membersByStatus,
        housingBreakdown,
        financials,
        recentPayments,
        enrolledMembers,
      ] = await Promise.all([
        ctx.prisma.season.findUnique({ where: { id: seasonId } }),
        ctx.prisma.seasonMember.groupBy({
          by: ['status'],
          where: { seasonId },
          _count: true,
        }),
        ctx.prisma.seasonMember.groupBy({
          by: ['housingType'],
          where: { seasonId, housingType: { not: null } },
          _count: true,
        }),
        ctx.prisma.payment.aggregate({
          where: { seasonMember: { seasonId } },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.prisma.payment.findMany({
          where: { seasonMember: { seasonId } },
          select: {
            id: true,
            amount: true,
            type: true,
            method: true,
            paidAt: true,
            seasonMember: {
              select: {
                member: { select: { name: true, playaName: true } },
              },
            },
          },
          orderBy: { paidAt: 'desc' },
          take: 10,
        }),
        // "Current members" excludes CANCELLED drop-outs; they still show in membersByStatus.
        ctx.prisma.seasonMember.count({ where: { seasonId, status: { not: 'CANCELLED' } } }),
      ]);

      const statusMap: Record<string, number> = {};
      for (const s of membersByStatus) {
        statusMap[s.status] = s._count;
      }

      const housingMap: Record<string, number> = {};
      for (const h of housingBreakdown) {
        if (h.housingType) housingMap[h.housingType] = h._count;
      }

      return {
        season,
        totalActiveMembers: enrolledMembers,
        membersByStatus: statusMap,
        housingBreakdown: housingMap,
        financial: {
          totalCollected: financials._sum.amount || 0,
          totalPayments: financials._count,
        },
        recentPayments: recentPayments.map((p) => ({
          id: p.id,
          amount: p.amount,
          type: p.type,
          method: p.method,
          paidAt: p.paidAt,
          memberName: p.seasonMember.member.name,
          playaName: p.seasonMember.member.playaName,
        })),
      };
    }),

  getMemberDashboard: memberProcedure
    .query(async ({ ctx }) => {
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
      });

      if (!activeSeason) {
        return { season: null, enrollment: null, payments: [], duesStatus: null };
      }

      const enrollment = await ctx.prisma.seasonMember.findUnique({
        where: {
          seasonId_memberId: {
            seasonId: activeSeason.id,
            memberId: ctx.user.id,
          },
        },
      });

      let payments: Payment[] = [];
      let duesStatus: { required: number; paid: number; remaining: number; isPaid: boolean } | null = null;

      if (enrollment) {
        payments = await ctx.prisma.payment.findMany({
          where: { seasonMemberId: enrollment.id },
          orderBy: { paidAt: 'desc' },
        });

        const totalPaid = payments
          .filter((p) => p.type === 'DUES')
          .reduce((sum, p) => sum + p.amount, 0);

        duesStatus = {
          required: activeSeason.duesAmount,
          paid: totalPaid,
          remaining: Math.max(0, activeSeason.duesAmount - totalPaid),
          isPaid: totalPaid >= activeSeason.duesAmount,
        };
      }

      return {
        season: {
          id: activeSeason.id,
          year: activeSeason.year,
          name: activeSeason.name,
          startDate: activeSeason.startDate,
          endDate: activeSeason.endDate,
          buildStartDate: activeSeason.buildStartDate,
          strikeEndDate: activeSeason.strikeEndDate,
        },
        enrollment,
        payments,
        duesStatus,
      };
    }),

  /**
   * Burning Man's official BRC forecast (via brcweather.com). Null whenever
   * the forecast is stale (>48h), unavailable, or unparseable — the portal
   * card renders nothing in that case, so off-season this simply disappears.
   */
  weather: memberProcedure.query(async () => {
    const now = new Date();
    const weather = await getBrcWeather(now);
    if (!weather) return null;
    if (now.getTime() - weather.updatedAt.getTime() > FRESH_WINDOW_MS) return null;
    return {
      updatedAt: weather.updatedAt,
      advisories: weather.advisories.filter((a) => a.expiresAt.getTime() > now.getTime()),
      periods: weather.periods,
      disclaimer: weather.disclaimer,
    };
  }),
});
