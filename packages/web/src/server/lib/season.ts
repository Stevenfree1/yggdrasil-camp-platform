import { z } from 'zod';
import { TRPCError } from '@trpc/server';

export const seasonRef = z.object({
  seasonId: z.string().uuid().optional(),
  seasonYear: z.number().int().min(2014).max(2100).optional(),
});

export async function resolveSeasonId(
  prisma: {
    season: {
      findFirst: (a: {
        where: { isActive: boolean } | { year: number };
        select: { id: true };
      }) => Promise<{ id: string } | null>;
    };
  },
  input: { seasonId?: string; seasonYear?: number },
): Promise<string> {
  if (input.seasonId) return input.seasonId;
  if (input.seasonYear) {
    const s = await prisma.season.findFirst({
      where: { year: input.seasonYear },
      select: { id: true },
    });
    if (!s)
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No season found for year ${input.seasonYear}`,
      });
    return s.id;
  }
  const active = await prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!active)
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No active season found',
    });
  return active.id;
}
