import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, BudgetCategory } from '@prisma/client';
import { router, managerProcedure } from '../trpc';
import logger from '../lib/logger';

const BUDGET_CATEGORIES = [
  'GENERATOR', 'FUEL', 'STORAGE', 'TRUCKS', 'SOUND', 'FOOD', 'CONTAINERS',
  'BATHROOMS', 'WATER', 'GREY_WATER', 'SHOWERS', 'DECORATION', 'TRASH',
  'SUPPLIES', 'ART', 'INFRASTRUCTURE', 'MISC',
] as const satisfies readonly BudgetCategory[];

export const budgetsRouter = router({
  /**
   * List all BudgetLine rows for one season, ordered by estimatedAmount desc.
   */
  list: managerProcedure
    .input(z.object({ seasonId: z.string().uuid().optional(), year: z.number().int().optional() }).optional().default({}))
    .query(async ({ ctx, input }) => {
      let seasonId = input.seasonId;
      if (!seasonId && input.year) {
        const s = await ctx.prisma.season.findUnique({ where: { year: input.year } });
        if (!s) throw new TRPCError({ code: 'NOT_FOUND', message: `Season ${input.year} not found` });
        seasonId = s.id;
      }
      const lines = await ctx.prisma.budgetLine.findMany({
        where: seasonId ? { seasonId } : undefined,
        include: { season: { select: { id: true, year: true, name: true } } },
        orderBy: { estimatedAmount: 'desc' },
      });
      const totalEstimated = lines.reduce((a, l) => a + (l.estimatedAmount ?? 0), 0);
      const totalActual = lines.reduce((a, l) => a + (l.actualAmount ?? 0), 0);
      return { lines, totalEstimated, totalActual };
    }),

  /**
   * Multi-year comparison view. Returns a matrix of category × year.
   * Each cell carries estimated + actual + description + notes for that (year, category).
   */
  compare: managerProcedure
    .input(
      z
        .object({
          years: z.array(z.number().int()).min(1).max(20).optional(),
        })
        .optional()
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const seasonFilter = input.years && input.years.length > 0 ? { year: { in: input.years } } : undefined;
      const seasons = await ctx.prisma.season.findMany({
        where: seasonFilter,
        orderBy: { year: 'asc' },
        select: { id: true, year: true, name: true },
      });
      const lines = await ctx.prisma.budgetLine.findMany({
        where: { seasonId: { in: seasons.map((s) => s.id) } },
      });
      const byCategory: Record<BudgetCategory, Record<number, { estimated: number; actual: number | null; description: string | null; notes: string | null }>> = {} as never;
      for (const cat of BUDGET_CATEGORIES) byCategory[cat] = {};
      for (const l of lines) {
        const yr = seasons.find((s) => s.id === l.seasonId)?.year;
        if (yr == null) continue;
        byCategory[l.category][yr] = {
          estimated: l.estimatedAmount,
          actual: l.actualAmount,
          description: l.description,
          notes: l.notes,
        };
      }
      // Per-year totals
      const totalsByYear: Record<number, { estimated: number; actual: number }> = {};
      for (const s of seasons) totalsByYear[s.year] = { estimated: 0, actual: 0 };
      for (const l of lines) {
        const yr = seasons.find((s) => s.id === l.seasonId)?.year;
        if (yr == null) continue;
        totalsByYear[yr].estimated += l.estimatedAmount;
        totalsByYear[yr].actual += l.actualAmount ?? 0;
      }
      // Order categories by lifetime spend (sum across years) desc
      const categoryTotals: Record<BudgetCategory, number> = {} as never;
      for (const cat of BUDGET_CATEGORIES) {
        categoryTotals[cat] = Object.values(byCategory[cat]).reduce((a, c) => a + c.estimated, 0);
      }
      const orderedCategories = [...BUDGET_CATEGORIES].sort((a, b) => categoryTotals[b] - categoryTotals[a]);

      return {
        seasons,
        categories: orderedCategories,
        matrix: byCategory,
        totalsByYear,
      };
    }),

  /**
   * Upsert a BudgetLine. Used by admin UI to edit estimates/actuals/notes.
   */
  upsert: managerProcedure
    .input(
      z.object({
        seasonId: z.string().uuid(),
        category: z.enum(BUDGET_CATEGORIES),
        description: z.string().max(200).optional().nullable(),
        estimatedAmount: z.number().int().nonnegative(),
        actualAmount: z.number().int().nonnegative().optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const line = await ctx.prisma.budgetLine.upsert({
        where: { seasonId_category: { seasonId: input.seasonId, category: input.category } },
        create: {
          seasonId: input.seasonId,
          category: input.category,
          description: input.description ?? null,
          estimatedAmount: input.estimatedAmount,
          actualAmount: input.actualAmount ?? null,
          notes: input.notes ?? null,
        },
        update: {
          description: input.description ?? null,
          estimatedAmount: input.estimatedAmount,
          actualAmount: input.actualAmount ?? null,
          notes: input.notes ?? null,
        },
      });
      logger.info({ id: line.id, seasonId: line.seasonId, category: line.category }, 'budget line upserted');
      return line;
    }),

  /**
   * Delete a BudgetLine.
   */
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.budgetLine.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
