import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { router, managerProcedure, memberProcedure } from '../trpc';
import logger from '../lib/logger';

async function resolveMyActiveSeasonMember(
  prisma: PrismaClient,
  user: { id: string; email: string },
): Promise<{ seasonMemberId: string; seasonId: string }> {
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!activeSeason) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
  const sm =
    (await prisma.seasonMember.findUnique({
      where: { seasonId_memberId: { seasonId: activeSeason.id, memberId: user.id } },
      select: { id: true },
    })) ??
    (await prisma.seasonMember.findFirst({
      where: { seasonId: activeSeason.id, member: { email: { equals: user.email, mode: 'insensitive' } } },
      select: { id: true },
    }));
  if (!sm) throw new TRPCError({ code: 'NOT_FOUND', message: 'You are not enrolled in the active season' });
  return { seasonMemberId: sm.id, seasonId: activeSeason.id };
}

// Maximum billable amount: $100,000, expressed in cents.
export const MAX_AMOUNT_CENTS = 100_000_00;
const amountSchema = z.number().int().min(1).max(MAX_AMOUNT_CENTS);

export const chargesRouter = router({
  // ── Catalog (admin) ──────────────────────────────────────────────
  itemsList: managerProcedure
    .input(z.object({ seasonId: z.string().uuid(), includeInactive: z.boolean().optional().default(false) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.chargeItem.findMany({
        where: { seasonId: input.seasonId, ...(input.includeInactive ? {} : { active: true }) },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    }),

  itemCreate: managerProcedure
    .input(z.object({
      seasonId: z.string().uuid(),
      name: z.string().min(1).max(120),
      description: z.string().max(2000).optional(),
      amountCents: amountSchema,
      selfServe: z.boolean().optional().default(false),
      sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.chargeItem.create({
        data: {
          seasonId: input.seasonId,
          name: input.name,
          description: input.description,
          amountCents: input.amountCents,
          selfServe: input.selfServe,
          sortOrder: input.sortOrder,
          createdBy: ctx.user.id,
        },
      });
      logger.info(`Charge item created: "${item.name}" ($${(item.amountCents / 100).toFixed(2)}) by ${ctx.user.email}`);
      return item;
    }),

  itemUpdate: managerProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(2000).nullable().optional(),
      amountCents: amountSchema.optional(),
      selfServe: z.boolean().optional(),
      active: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(10_000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        // Editing an item never rewrites existing charges (label/amount are snapshotted).
        const item = await ctx.prisma.chargeItem.update({ where: { id }, data });
        logger.info(`Charge item ${id} updated by ${ctx.user.email}`);
        return item;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Charge item not found' });
        }
        throw e;
      }
    }),

  // ── Assign / void (admin) ────────────────────────────────────────
  assign: managerProcedure
    .input(z.object({
      seasonMemberId: z.string().uuid(),
      itemId: z.string().uuid().optional(),
      label: z.string().min(1).max(120).optional(),
      amountCents: amountSchema.optional(),
      note: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sm = await ctx.prisma.seasonMember.findUnique({ where: { id: input.seasonMemberId }, select: { id: true } });
      if (!sm) throw new TRPCError({ code: 'NOT_FOUND', message: 'Season member not found' });
      let label = input.label;
      let amountCents = input.amountCents;
      if (input.itemId) {
        const item = await ctx.prisma.chargeItem.findUnique({ where: { id: input.itemId } });
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Charge item not found' });
        label = label ?? item.name;
        amountCents = amountCents ?? item.amountCents;
      }
      if (!label || amountCents === undefined) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A label and amount are required' });
      }
      const charge = await ctx.prisma.charge.create({
        data: {
          seasonMemberId: input.seasonMemberId,
          itemId: input.itemId ?? null,
          label,
          amountCents,
          status: 'OPEN',
          source: 'ADMIN',
          note: input.note,
          createdBy: ctx.user.id,
        },
      });
      await ctx.prisma.auditLog.create({
        data: {
          memberId: ctx.user.id, action: 'CHARGE_ASSIGNED', entityType: 'Charge', entityId: charge.id,
          details: { seasonMemberId: input.seasonMemberId, label, amountCents, source: 'ADMIN' },
        },
      });
      logger.info(`Charge "${label}" ($${(amountCents / 100).toFixed(2)}) assigned to ${input.seasonMemberId} by ${ctx.user.email}`);
      return charge;
    }),

  void: managerProcedure
    .input(z.object({ chargeId: z.string().uuid(), note: z.string().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const charge = await ctx.prisma.charge.findUnique({ where: { id: input.chargeId } });
      if (!charge) throw new TRPCError({ code: 'NOT_FOUND', message: 'Charge not found' });
      if (charge.status !== 'OPEN') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Only open charges can be voided (this one is ${charge.status})` });
      }
      const res = await ctx.prisma.charge.updateMany({
        where: { id: input.chargeId, status: 'OPEN' },
        data: {
          status: 'VOID',
          voidedById: ctx.user.id,
          voidedAt: new Date(),
          note: input.note !== undefined ? input.note : charge.note,
        },
      });
      if (res.count === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Charge is no longer open' });
      }
      await ctx.prisma.auditLog.create({
        data: { memberId: ctx.user.id, action: 'CHARGE_VOIDED', entityType: 'Charge', entityId: charge.id, details: { label: charge.label, amountCents: charge.amountCents } },
      });
      return ctx.prisma.charge.findUnique({ where: { id: input.chargeId } });
    }),

  /**
   * Settle an OPEN charge with an OFFLINE payment (cash / Zelle / Venmo / …) —
   * the manual-entry counterpart to the PayPal capture path. Atomically flips
   * the charge to PAID and records a Payment linked to it (type OTHER, like the
   * PayPal charge path), so it shows in the member's payment history.
   */
  markPaid: managerProcedure
    .input(z.object({
      chargeId: z.string().uuid(),
      method: z.enum(['VENMO', 'ZELLE', 'CASH', 'ACH', 'CARD', 'PAYPAL', 'OTHER']),
      paidAt: z.string().datetime().optional(),
      note: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const charge = await ctx.prisma.charge.findUnique({ where: { id: input.chargeId } });
      if (!charge) throw new TRPCError({ code: 'NOT_FOUND', message: 'Charge not found' });
      if (charge.status !== 'OPEN') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Only open charges can be marked paid (this one is ${charge.status})` });
      }
      const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

      await ctx.prisma.$transaction(async (tx) => {
        // Atomic guard: only the request that flips OPEN→PAID records the payment,
        // so a concurrent mark-paid / PayPal capture can't double-settle the charge.
        const res = await tx.charge.updateMany({
          where: { id: charge.id, status: 'OPEN' },
          data: { status: 'PAID', paidAt },
        });
        if (res.count === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Charge is no longer open' });
        }
        await tx.payment.create({
          data: {
            seasonMemberId: charge.seasonMemberId,
            chargeId: charge.id,
            type: 'OTHER',
            amount: charge.amountCents,
            method: input.method,
            paidAt,
            notes: input.note ?? `Offline ${input.method} payment — ${charge.label}`,
            recordedBy: ctx.user.name,
          },
        });
        await tx.auditLog.create({
          data: {
            memberId: ctx.user.id, action: 'CHARGE_MARKED_PAID', entityType: 'Charge', entityId: charge.id,
            details: { label: charge.label, amountCents: charge.amountCents, method: input.method },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

      logger.info(`Charge ${charge.id} "${charge.label}" ($${(charge.amountCents / 100).toFixed(2)}) marked paid offline (${input.method}) by ${ctx.user.email}`);
      return ctx.prisma.charge.findUnique({ where: { id: charge.id } });
    }),

  /** All charges for a member (admin view on the roster). */
  listForMember: managerProcedure
    .input(z.object({ seasonMemberId: z.string().uuid(), limit: z.number().int().min(1).max(500).optional().default(200) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.charge.findMany({
        where: { seasonMemberId: input.seasonMemberId },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  // ── Member self-serve ────────────────────────────────────────────
  /** Self-serve catalog items the member can add. */
  myAvailableItems: memberProcedure.query(async ({ ctx }) => {
    const activeSeason = await ctx.prisma.season.findFirst({ where: { isActive: true }, select: { id: true } });
    if (!activeSeason) return [];
    return ctx.prisma.chargeItem.findMany({
      where: { seasonId: activeSeason.id, active: true, selfServe: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, description: true, amountCents: true },
    });
  }),

  addSelfServe: memberProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { seasonMemberId, seasonId } = await resolveMyActiveSeasonMember(ctx.prisma, ctx.user);
      const item = await ctx.prisma.chargeItem.findUnique({ where: { id: input.itemId } });
      // Last line of defense: the item must belong to the active season and be a live self-serve item.
      if (!item || item.seasonId !== seasonId || !item.active || !item.selfServe) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'That item is not available to add' });
      }
      // Best-effort duplicate guard. There is no DB unique on (seasonMemberId,itemId)
      // — a partial "OPEN-only" unique isn't expressible in Prisma, and a full unique
      // would block re-adding an item after removing it — so a rapid double-submit can
      // in theory create two OPEN charges. Tolerable at camp scale (no money moves; the
      // member or an admin can remove the duplicate).
      const existing = await ctx.prisma.charge.findFirst({
        where: { seasonMemberId, itemId: item.id, status: 'OPEN' },
        select: { id: true },
      });
      if (existing) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That item is already on your tab' });
      return ctx.prisma.charge.create({
        data: {
          seasonMemberId, itemId: item.id, label: item.name, amountCents: item.amountCents,
          status: 'OPEN', source: 'SELF', createdBy: null,
        },
      });
    }),

  removeMine: memberProcedure
    .input(z.object({ chargeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { seasonMemberId } = await resolveMyActiveSeasonMember(ctx.prisma, ctx.user);
      const charge = await ctx.prisma.charge.findUnique({ where: { id: input.chargeId } });
      if (!charge || charge.seasonMemberId !== seasonMemberId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Charge not found' });
      }
      if (charge.status !== 'OPEN' || charge.source !== 'SELF') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only remove items you added that are still unpaid' });
      }
      const res = await ctx.prisma.charge.updateMany({
        where: { id: charge.id, seasonMemberId, status: 'OPEN', source: 'SELF' },
        data: { status: 'VOID', voidedById: ctx.user.id, voidedAt: new Date() },
      });
      if (res.count === 0) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'That item can no longer be removed' });
      }
      await ctx.prisma.auditLog.create({
        data: { memberId: ctx.user.id, action: 'CHARGE_SELF_REMOVED', entityType: 'Charge', entityId: charge.id, details: { label: charge.label, amountCents: charge.amountCents } },
      });
      return ctx.prisma.charge.findUnique({ where: { id: charge.id } });
    }),
});
