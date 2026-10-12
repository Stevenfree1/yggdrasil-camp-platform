import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { router, managerProcedure } from '../trpc';
import logger from '../lib/logger';

export const expensesRouter = router({
  list: managerProcedure
    .input(
      z
        .object({
          seasonId: z.string().uuid().optional(),
          paidBy: z.string().max(200).optional(),
          category: z.string().max(100).optional(),
          needsReimbursement: z.boolean().optional(),
          reimbursed: z.boolean().optional(),
          search: z.string().max(200).optional(),
          limit: z.number().int().min(1).max(500).optional().default(100),
          offset: z.number().int().min(0).optional().default(0),
        })
        .optional()
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.ExpenseWhereInput = {};
      if (input.seasonId) where.seasonId = input.seasonId;
      if (input.paidBy) where.paidBy = { equals: input.paidBy, mode: 'insensitive' };
      if (input.category) where.category = input.category;
      if (typeof input.needsReimbursement === 'boolean') where.needsReimbursement = input.needsReimbursement;
      if (typeof input.reimbursed === 'boolean') where.reimbursed = input.reimbursed;
      if (input.search) {
        where.OR = [
          { description: { contains: input.search, mode: 'insensitive' } },
          { notes: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      const [expenses, total, sumAgg] = await Promise.all([
        ctx.prisma.expense.findMany({
          where,
          include: { season: { select: { id: true, year: true, name: true } } },
          orderBy: { date: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.expense.count({ where }),
        ctx.prisma.expense.aggregate({ where, _sum: { amount: true } }),
      ]);

      return { expenses, total, totalAmount: sumAgg._sum.amount ?? 0 };
    }),

  getSummary: managerProcedure
    .input(z.object({ seasonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const where = { seasonId: input.seasonId };

      const [byPaidBy, byCategory, total, reimbursementStatus] = await Promise.all([
        ctx.prisma.expense.groupBy({
          by: ['paidBy'],
          where,
          _sum: { amount: true },
          _count: true,
          orderBy: { _sum: { amount: 'desc' } },
        }),
        ctx.prisma.expense.groupBy({
          by: ['category'],
          where,
          _sum: { amount: true },
          _count: true,
        }),
        ctx.prisma.expense.aggregate({
          where,
          _sum: { amount: true },
          _count: true,
        }),
        ctx.prisma.expense.groupBy({
          by: ['needsReimbursement', 'reimbursed'],
          where,
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      return {
        total: { amount: total._sum.amount ?? 0, count: total._count },
        byPaidBy: byPaidBy.map((b) => ({ paidBy: b.paidBy, amount: b._sum.amount ?? 0, count: b._count })),
        byCategory: byCategory.map((b) => ({ category: b.category, amount: b._sum.amount ?? 0, count: b._count })),
        reimbursementStatus,
      };
    }),

  create: managerProcedure
    .input(
      z.object({
        seasonId: z.string().uuid(),
        description: z.string().min(1).max(500),
        amount: z.number().int().min(1).max(1_000_000_00),
        paidBy: z.string().min(1).max(200),
        date: z.string().datetime(),
        category: z.string().max(100).optional(),
        receiptUrl: z.string().url().max(2000).optional(),
        needsReimbursement: z.boolean().optional().default(false),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const season = await ctx.prisma.season.findUnique({ where: { id: input.seasonId }, select: { id: true } });
      if (!season) throw new TRPCError({ code: 'NOT_FOUND', message: 'Season not found' });

      const expense = await ctx.prisma.expense.create({
        data: {
          seasonId: input.seasonId,
          description: input.description,
          amount: input.amount,
          paidBy: input.paidBy,
          date: new Date(input.date),
          category: input.category,
          receiptUrl: input.receiptUrl,
          needsReimbursement: input.needsReimbursement,
          reimbursed: false,
          notes: input.notes,
        },
      });

      logger.info(`Expense recorded: $${(input.amount / 100).toFixed(2)} by ${input.paidBy} (${ctx.user.email})`);
      return expense;
    }),

  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        description: z.string().min(1).max(500).optional(),
        amount: z.number().int().min(1).max(1_000_000_00).optional(),
        paidBy: z.string().min(1).max(200).optional(),
        date: z.string().datetime().optional(),
        category: z.string().max(100).nullable().optional(),
        receiptUrl: z.string().url().max(2000).nullable().optional(),
        needsReimbursement: z.boolean().optional(),
        notes: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, date, ...rest } = input;
      return ctx.prisma.expense.update({
        where: { id },
        data: {
          ...rest,
          ...(date ? { date: new Date(date) } : {}),
        },
      });
    }),

  markReimbursed: managerProcedure
    .input(z.object({ id: z.string().uuid(), reimbursed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.expense.update({
        where: { id: input.id },
        data: {
          reimbursed: input.reimbursed,
          reimbursedAt: input.reimbursed ? new Date() : null,
        },
      });
    }),
});
