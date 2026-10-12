import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma, type PrismaClient } from '@prisma/client';
import { router, memberProcedure, managerProcedure } from '../trpc';
import logger from '../lib/logger';
import { getCampConfig } from '@/lib/config';
import { getAppUrl, getStripe } from '../lib/stripe';
import { createPayPalOrder, capturePayPalOrder, getPayPalOrder, createPayPalOrderWithUnits, type PayPalUnitInput } from '../lib/paypal';
import { recordPaidPayPalOrder, recordPayPalOrderTargets } from '../lib/paypal-payments';
import { duesRemainingCents, effectiveDuesCents, resolveDuesPaymentCents } from '../lib/billing';
import { formatPayTarget, parsePayTarget } from '../lib/pay-targets';

/**
 * Resolve the signed-in member's enrollment in the active season and the
 * remaining dues balance (in cents). Shared by the dues checkout procedures.
 */
async function resolveActiveDues(
  prisma: PrismaClient,
  user: { id: string; email: string },
) {
  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true, year: true, name: true, duesAmount: true },
  });

  if (!activeSeason) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
  }

  const seasonMember =
    (await prisma.seasonMember.findUnique({
      where: { seasonId_memberId: { seasonId: activeSeason.id, memberId: user.id } },
      include: {
        payments: { where: { type: 'DUES' }, select: { amount: true } },
        member: { select: { email: true, name: true } },
      },
    })) ??
    (await prisma.seasonMember.findFirst({
      where: {
        seasonId: activeSeason.id,
        member: { email: { equals: user.email, mode: 'insensitive' } },
      },
      include: {
        payments: { where: { type: 'DUES' }, select: { amount: true } },
        member: { select: { email: true, name: true } },
      },
    }));

  if (!seasonMember) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'You are not enrolled in the active season',
    });
  }

  const duesPaid = seasonMember.payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = duesRemainingCents({
    duesStatus: seasonMember.duesStatus,
    duesOverrideCents: seasonMember.duesOverrideCents,
    seasonDuesCents: activeSeason.duesAmount,
    duesPaidCents: duesPaid,
  });

  return { activeSeason, seasonMember, remaining };
}

/**
 * Re-derive the roster dues flag after a DUES ledger row is edited or removed.
 * Only flips between PAID and UNPAID — a manually WAIVED status is never
 * touched. Runs inside the same transaction as the ledger write.
 */
async function syncDuesFlag(
  tx: Prisma.TransactionClient,
  seasonMemberId: string,
  editorId: string,
) {
  const [duesCount, sm] = await Promise.all([
    tx.payment.count({ where: { seasonMemberId, type: 'DUES' } }),
    tx.seasonMember.findUniqueOrThrow({
      where: { id: seasonMemberId },
      select: { duesStatus: true },
    }),
  ]);
  const next = duesCount > 0
    ? (sm.duesStatus === 'UNPAID' ? 'PAID' as const : null)
    : (sm.duesStatus === 'PAID' ? 'UNPAID' as const : null);
  if (next) {
    await tx.seasonMember.update({
      where: { id: seasonMemberId },
      data: { duesStatus: next, duesUpdatedById: editorId, duesUpdatedAt: new Date() },
    });
  }
}

const paymentTypeEnum = z.enum([
  'DUES', 'GRID', 'FOOD', 'DONATION', 'RV_VOUCHER',
  'BEER_FUND', 'TENT', 'TICKET', 'STRIKE_DONATION', 'FUNDRAISING', 'OTHER',
]);

const paymentMethodEnum = z.enum([
  'VENMO', 'ZELLE', 'CASH', 'ACH', 'CARD', 'PAYPAL', 'OTHER',
]);

const payLineSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('dues'), amountCents: z.number().int().positive().max(100_000_00).optional() }),
  z.object({ kind: z.literal('charge'), chargeId: z.string().uuid() }),
]);

export const paymentsRouter = router({
  createDuesCheckoutSession: memberProcedure
    .input(z.object({
      paymentMethod: z.enum(['ach', 'card']).optional().default('ach'),
    }).optional().default({ paymentMethod: 'ach' }))
    .mutation(async ({ ctx, input }) => {
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true, year: true, name: true, duesAmount: true },
      });

      if (!activeSeason) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No active season found' });
      }

      const seasonMember = await ctx.prisma.seasonMember.findUnique({
        where: {
          seasonId_memberId: {
            seasonId: activeSeason.id,
            memberId: ctx.user.id,
          },
        },
        include: {
          payments: { where: { type: 'DUES' }, select: { amount: true } },
          member: { select: { email: true, name: true } },
        },
      }) ?? await ctx.prisma.seasonMember.findFirst({
        where: {
          seasonId: activeSeason.id,
          member: { email: { equals: ctx.user.email, mode: 'insensitive' } },
        },
        include: {
          payments: { where: { type: 'DUES' }, select: { amount: true } },
          member: { select: { email: true, name: true } },
        },
      });

      if (!seasonMember) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'You are not enrolled in the active season',
        });
      }

      const duesPaid = seasonMember.payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = Math.max(0, activeSeason.duesAmount - duesPaid);

      if (remaining <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Your season dues are already paid' });
      }

      const appUrl = getAppUrl();
      const stripe = getStripe();
      const paymentMethodTypes = input.paymentMethod === 'ach'
        ? (['us_bank_account'] as const)
        : (['card'] as const);

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: seasonMember.member.email,
        client_reference_id: seasonMember.id,
        payment_method_types: [...paymentMethodTypes],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: remaining,
              product_data: {
                name: `${activeSeason.name} membership dues`,
                description: `${getCampConfig().name} ${activeSeason.year} season dues`,
              },
            },
          },
        ],
        metadata: {
          paymentType: 'DUES',
          seasonId: activeSeason.id,
          seasonMemberId: seasonMember.id,
          memberId: seasonMember.memberId,
        },
        success_url: `${appUrl}/portal/payments?checkout=success`,
        cancel_url: `${appUrl}/portal/payments?checkout=cancelled`,
      });

      if (!session.url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Stripe did not return a checkout URL',
        });
      }

      logger.info(`Stripe dues checkout created for ${ctx.user.email}: ${session.id}`);

      return { url: session.url, sessionId: session.id };
    }),

  /**
   * Create a PayPal order for the member's remaining season dues.
   * The amount is computed server-side; the client never sends a price.
   */
  createDuesPayPalOrder: memberProcedure
    .mutation(async ({ ctx }) => {
      const { activeSeason, seasonMember, remaining } = await resolveActiveDues(
        ctx.prisma,
        ctx.user,
      );

      if (remaining <= 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Your season dues are already paid' });
      }

      const order = await createPayPalOrder({
        amountCents: remaining,
        referenceId: seasonMember.id,
        description: `${getCampConfig().name} ${activeSeason.year} season dues`,
      });

      logger.info(`PayPal dues order created for ${ctx.user.email}: ${order.id}`);
      return { orderId: order.id };
    }),

  /**
   * Capture a previously created PayPal dues order and record the payment.
   * Authorizes that the order belongs to the requesting member (custom_id ===
   * their seasonMember id) before capturing, so one member cannot capture an
   * order created for someone else.
   */
  captureDuesPayPalOrder: memberProcedure
    .input(z.object({ orderId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const { seasonMember } = await resolveActiveDues(ctx.prisma, ctx.user);

      const order = await getPayPalOrder(input.orderId);
      const unit = order.purchase_units?.[0];
      const orderSeasonMemberId = unit?.custom_id || unit?.reference_id;

      if (orderSeasonMemberId !== seasonMember.id) {
        logger.warn(
          `PayPal capture rejected: order ${input.orderId} (custom_id ${orderSeasonMemberId}) does not belong to ${ctx.user.email}`,
        );
        throw new TRPCError({ code: 'FORBIDDEN', message: 'This payment does not belong to you' });
      }

      if (order.status !== 'COMPLETED') {
        await capturePayPalOrder(input.orderId);
      }

      const result = await recordPaidPayPalOrder(input.orderId);

      if (result === 'ignored') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'PayPal payment could not be confirmed. Please contact your camp lead.',
        });
      }

      logger.info(`PayPal dues order ${input.orderId} ${result} for ${ctx.user.email}`);
      return { status: 'COMPLETED' as const, result };
    }),

  createPayPalOrder: memberProcedure
    .input(z.object({ lines: z.array(payLineSchema).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const { activeSeason, seasonMember, remaining } = await resolveActiveDues(ctx.prisma, ctx.user);
      const units: PayPalUnitInput[] = [];
      let duesSeen = false;

      for (const line of input.lines) {
        if (line.kind === 'dues') {
          if (duesSeen) continue; // one dues line max
          duesSeen = true;
          if (remaining <= 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Your season dues are already paid' });
          }
          const amountCents = resolveDuesPaymentCents(line.amountCents, remaining);
          units.push({
            customId: formatPayTarget({ kind: 'dues', seasonMemberId: seasonMember.id }),
            description: `${getCampConfig().name} ${activeSeason.year} season dues`,
            amountCents,
          });
        } else {
          const charge = await ctx.prisma.charge.findUnique({ where: { id: line.chargeId } });
          if (!charge || charge.seasonMemberId !== seasonMember.id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'That charge is not on your tab' });
          }
          if (charge.status !== 'OPEN') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `"${charge.label}" is ${charge.status.toLowerCase()}, not payable` });
          }
          units.push({
            customId: formatPayTarget({ kind: 'charge', chargeId: charge.id }),
            description: charge.label,
            amountCents: charge.amountCents,
          });
        }
      }
      if (units.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nothing to pay' });

      const order = await createPayPalOrderWithUnits(units);
      logger.info(`PayPal order ${order.id} created for ${ctx.user.email} (${units.length} unit(s))`);
      return { orderId: order.id };
    }),

  capturePayPalOrder: memberProcedure
    .input(z.object({ orderId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const { seasonMember } = await resolveActiveDues(ctx.prisma, ctx.user);
      const order = await getPayPalOrder(input.orderId);

      // Authz: every unit must target THIS member (their dues, or a charge they own).
      for (const unit of order.purchase_units ?? []) {
        const target = parsePayTarget(unit.custom_id || unit.reference_id);
        if (!target) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Malformed order' });
        if (target.kind === 'dues' && target.seasonMemberId !== seasonMember.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'This payment does not belong to you' });
        }
        if (target.kind === 'charge') {
          const ch = await ctx.prisma.charge.findUnique({ where: { id: target.chargeId }, select: { seasonMemberId: true } });
          if (!ch || ch.seasonMemberId !== seasonMember.id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'This payment does not belong to you' });
          }
        }
      }

      if (order.status !== 'COMPLETED') await capturePayPalOrder(input.orderId);
      const result = await recordPayPalOrderTargets(input.orderId);
      if (result.recorded === 0 && result.duplicate === 0) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'PayPal payment could not be confirmed. Please contact your camp lead.' });
      }
      logger.info(`PayPal order ${input.orderId} captured for ${ctx.user.email}: ${JSON.stringify(result)}`);
      return { status: 'COMPLETED' as const, ...result };
    }),

  list: managerProcedure
    .input(z.object({
      seasonId: z.string().uuid().optional(),
      type: paymentTypeEnum.optional(),
      method: paymentMethodEnum.optional(),
      memberId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const where: Prisma.PaymentWhereInput = {};

      if (input.seasonId || input.memberId) {
        const seasonMemberFilter: Prisma.SeasonMemberWhereInput = {};
        if (input.seasonId) seasonMemberFilter.seasonId = input.seasonId;
        if (input.memberId) seasonMemberFilter.memberId = input.memberId;
        where.seasonMember = seasonMemberFilter;
      }
      if (input.type) where.type = input.type;
      if (input.method) where.method = input.method;

      const [payments, total] = await Promise.all([
        ctx.prisma.payment.findMany({
          where,
          include: {
            seasonMember: {
              include: {
                member: { select: { id: true, name: true, email: true, playaName: true } },
                season: { select: { id: true, year: true, name: true } },
              },
            },
          },
          orderBy: { paidAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.payment.count({ where }),
      ]);

      return { payments, total };
    }),

  create: managerProcedure
    .input(z.object({
      seasonMemberId: z.string().uuid(),
      type: paymentTypeEnum,
      amount: z.number().int().min(1).max(100_000_00), // Max $100,000 in cents
      method: paymentMethodEnum,
      paidTo: z.string().max(200).optional(),
      paidAt: z.string().datetime(),
      notes: z.string().max(2000).optional(),
      recordedBy: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the season member exists
      const sm = await ctx.prisma.seasonMember.findUnique({
        where: { id: input.seasonMemberId },
        include: { member: { select: { name: true, email: true } } },
      });

      if (!sm) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Season member not found' });
      }

      const createPayment = ctx.prisma.payment.create({
        data: {
          seasonMemberId: input.seasonMemberId,
          type: input.type,
          amount: input.amount,
          method: input.method,
          paidTo: input.paidTo,
          paidAt: new Date(input.paidAt),
          notes: input.notes,
          recordedBy: input.recordedBy || ctx.user.name,
        },
        include: {
          seasonMember: {
            include: {
              member: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      // Only a DUES payment flips the roster row's membership dues flag; other
      // payment types (GRID/FOOD/etc.) are pure ledger entries. Run the flag
      // update in the same transaction as the ledger write for atomicity.
      let payment;
      if (input.type === 'DUES') {
        const [created] = await ctx.prisma.$transaction([
          createPayment,
          ctx.prisma.seasonMember.update({
            where: { id: input.seasonMemberId },
            // Stamp the editor/timestamp like setDuesStatus does, so the dues
            // flag carries a consistent audit trail regardless of which path
            // set it (record-payment vs. the dedicated dues setter).
            data: {
              duesStatus: 'PAID',
              duesUpdatedById: ctx.user.id,
              duesUpdatedAt: new Date(),
            },
          }),
        ]);
        payment = created;
      } else {
        payment = await createPayment;
      }

      logger.info(`Payment recorded: $${(input.amount / 100).toFixed(2)} ${input.type} for ${sm.member.name} by ${ctx.user.email}`);

      return payment;
    }),

  update: managerProcedure
    .input(z.object({
      id: z.string().uuid(),
      type: paymentTypeEnum.optional(),
      amount: z.number().int().min(1).max(100_000_00).optional(),
      method: paymentMethodEnum.optional(),
      paidTo: z.string().max(200).nullish(),
      paidAt: z.string().datetime().optional(),
      notes: z.string().max(2000).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.payment.findUnique({
        where: { id: input.id },
        include: {
          seasonMember: { include: { member: { select: { name: true } } } },
        },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment not found' });
      }
      if (existing.processor) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This payment was recorded by a payment processor and cannot be edited',
        });
      }

      const data: Prisma.PaymentUpdateInput = {};
      if (input.type !== undefined) data.type = input.type;
      if (input.amount !== undefined) data.amount = input.amount;
      if (input.method !== undefined) data.method = input.method;
      if (input.paidTo !== undefined) data.paidTo = input.paidTo || null;
      if (input.paidAt !== undefined) data.paidAt = new Date(input.paidAt);
      if (input.notes !== undefined) data.notes = input.notes || null;

      // Changing type into or out of DUES can invalidate the roster dues flag.
      const duesAffected = input.type !== undefined
        && input.type !== existing.type
        && (input.type === 'DUES' || existing.type === 'DUES');

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const p = await tx.payment.update({ where: { id: input.id }, data });
        if (duesAffected) await syncDuesFlag(tx, existing.seasonMemberId, ctx.user.id);
        return p;
      });

      logger.info(`Payment ${input.id} (${existing.seasonMember.member.name}) edited by ${ctx.user.email}`);

      return updated;
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.payment.findUnique({
        where: { id: input.id },
        include: {
          seasonMember: { include: { member: { select: { name: true } } } },
        },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment not found' });
      }
      if (existing.processor) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This payment was recorded by a payment processor and cannot be deleted',
        });
      }

      await ctx.prisma.$transaction(async (tx) => {
        await tx.payment.delete({ where: { id: input.id } });
        if (existing.type === 'DUES') await syncDuesFlag(tx, existing.seasonMemberId, ctx.user.id);
      });

      logger.info(`Payment ${input.id} ($${(existing.amount / 100).toFixed(2)} ${existing.type}, ${existing.seasonMember.member.name}) deleted by ${ctx.user.email}`);

      return { success: true };
    }),

  getMyPayments: memberProcedure
    .query(async ({ ctx }) => {
      const activeSeason = await ctx.prisma.season.findFirst({
        where: { isActive: true },
        select: { id: true },
      });

      if (!activeSeason) return [];

      const sm = await ctx.prisma.seasonMember.findUnique({
        where: {
          seasonId_memberId: {
            seasonId: activeSeason.id,
            memberId: ctx.user.id,
          },
        },
        select: { id: true },
      }) ?? await ctx.prisma.seasonMember.findFirst({
        where: {
          seasonId: activeSeason.id,
          member: { email: { equals: ctx.user.email, mode: 'insensitive' } },
        },
        select: { id: true },
      });

      if (!sm) return [];

      return ctx.prisma.payment.findMany({
        where: { seasonMemberId: sm.id },
        orderBy: { paidAt: 'desc' },
      });
    }),

  getSummary: managerProcedure
    .input(z.object({ seasonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [byType, byMethod, total] = await Promise.all([
        ctx.prisma.payment.groupBy({
          by: ['type'],
          where: { seasonMember: { seasonId: input.seasonId } },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.prisma.payment.groupBy({
          by: ['method'],
          where: { seasonMember: { seasonId: input.seasonId } },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.prisma.payment.aggregate({
          where: { seasonMember: { seasonId: input.seasonId } },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      // Dues progress: how many members have paid dues and how much
      const season = await ctx.prisma.season.findUnique({
        where: { id: input.seasonId },
        select: { duesAmount: true },
      });

      const confirmedMembers = await ctx.prisma.seasonMember.findMany({
        where: { seasonId: input.seasonId, status: 'CONFIRMED' },
        select: { duesStatus: true, duesOverrideCents: true },
      });
      const confirmedCount = confirmedMembers.length;

      const duesCollected = byType.find((t) => t.type === 'DUES')?._sum.amount || 0;
      const expectedDues = confirmedMembers.reduce(
        (sum, m) => sum + effectiveDuesCents(m.duesStatus, m.duesOverrideCents, season?.duesAmount || 0),
        0,
      );

      return {
        totalCollected: total._sum.amount || 0,
        totalPayments: total._count,
        byType: byType.map((t) => ({
          type: t.type,
          total: t._sum.amount || 0,
          count: t._count,
        })),
        byMethod: byMethod.map((m) => ({
          method: m.method,
          total: m._sum.amount || 0,
          count: m._count,
        })),
        duesProgress: {
          collected: duesCollected,
          expected: expectedDues,
          confirmedMembers: confirmedCount,
        },
      };
    }),
});
