import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import logger from './logger';
import { getPayPalOrder, valueToCents, type PayPalOrder, type PayPalCapture } from './paypal';
import { parsePayTarget } from './pay-targets';
import { duesRemainingCents } from './billing';

/**
 * Record a completed PayPal dues order into the Payment ledger.
 *
 * Both the client capture path (payments.captureDuesPayPalOrder) and the
 * webhook path call this with just the order id. We re-fetch the order from
 * PayPal here so the amount and status are always authoritative — the client
 * is never trusted for money values. Idempotent on the order id via the
 * unique `processorCheckoutSessionId` column, so duplicate deliveries (capture
 * response + webhook) collapse to a single Payment row.
 */
export async function recordPaidPayPalOrder(
  orderIdOrOrder: string | PayPalOrder,
): Promise<'recorded' | 'duplicate' | 'ignored'> {
  const order =
    typeof orderIdOrOrder === 'string'
      ? await getPayPalOrder(orderIdOrOrder)
      : orderIdOrOrder;

  if (order.status !== 'COMPLETED') {
    logger.info(`PayPal order ${order.id} is ${order.status}; not recording yet`);
    return 'ignored';
  }

  const unit = order.purchase_units?.[0];
  const seasonMemberId = unit?.custom_id || unit?.reference_id;
  const capture = unit?.payments?.captures?.[0];

  if (!seasonMemberId) {
    logger.error(`PayPal order ${order.id} has no custom_id/reference_id; cannot reconcile`);
    return 'ignored';
  }

  if (!capture || capture.status !== 'COMPLETED') {
    logger.info(`PayPal order ${order.id} has no completed capture; not recording yet`);
    return 'ignored';
  }

  const amount = valueToCents(capture.amount?.value);
  if (amount <= 0) {
    logger.warn(`PayPal order ${order.id} capture ${capture.id} had no positive amount`);
    return 'ignored';
  }

  const existing = await prisma.payment.findUnique({
    where: { processorCheckoutSessionId: order.id },
    select: { id: true },
  });
  if (existing) return 'duplicate';

  const seasonMember = await prisma.seasonMember.findUnique({
    where: { id: seasonMemberId },
    include: {
      member: { select: { email: true, name: true } },
      season: { select: { id: true } },
    },
  });

  if (!seasonMember) {
    logger.error(`PayPal order ${order.id} references missing seasonMember ${seasonMemberId}`);
    return 'ignored';
  }

  const feeAmount = valueToCents(capture.seller_receivable_breakdown?.paypal_fee?.value) || null;
  const netAmount = valueToCents(capture.seller_receivable_breakdown?.net_amount?.value) || null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          seasonMemberId,
          type: 'DUES',
          amount,
          method: 'PAYPAL',
          paidTo: 'PayPal',
          paidAt: new Date(),
          notes: `PayPal order ${order.id} (capture ${capture.id})`,
          recordedBy: 'PayPal',
          processor: 'PAYPAL',
          processorCheckoutSessionId: order.id,
          processorPaymentIntentId: capture.id,
          processorPaymentMethodType: 'paypal',
          feeAmount,
          netAmount,
        },
      });

      await tx.application.updateMany({
        where: {
          seasonId: seasonMember.season.id,
          email: seasonMember.member.email,
          status: { in: ['PRE_APPROVED', 'INVITED', 'ACCEPTED'] },
        },
        data: {
          status: 'DUES_PAID',
          duesPaidAt: new Date(),
        },
      });

      // New membership-status signal: flip the roster row's dues flag in the
      // same transaction so the ledger row and the status flag stay consistent.
      await tx.seasonMember.update({
        where: { id: seasonMemberId },
        data: { duesStatus: 'PAID' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'duplicate';
    }
    throw err;
  }

  logger.info(`Recorded PayPal dues payment ${order.id} for ${seasonMember.member.email}`);
  return 'recorded';
}

type RecordOutcome = 'recorded' | 'duplicate' | 'ignored';

/**
 * Record every completed purchase unit of a (possibly multi-target) PayPal order.
 * - Idempotent per unit via the unit's capture id stored in processorCheckoutSessionId.
 * - DUES units flip duesStatus → PAID only when remaining reaches 0 (partial-dues aware).
 * - CHARGE units set Payment.chargeId and flip the charge → PAID + paidAt.
 */
export async function recordPayPalOrderTargets(
  orderIdOrOrder: string | PayPalOrder,
): Promise<{ recorded: number; duplicate: number; ignored: number }> {
  const order = typeof orderIdOrOrder === 'string' ? await getPayPalOrder(orderIdOrOrder) : orderIdOrOrder;
  const tally = { recorded: 0, duplicate: 0, ignored: 0 };
  if (order.status !== 'COMPLETED') {
    logger.info(`PayPal order ${order.id} is ${order.status}; not recording`);
    return tally;
  }

  for (const unit of order.purchase_units ?? []) {
    const target = parsePayTarget(unit.custom_id || unit.reference_id);
    const capture = unit.payments?.captures?.[0];
    if (!target || !capture || capture.status !== 'COMPLETED') {
      tally.ignored += 1;
      continue;
    }
    const amount = valueToCents(capture.amount?.value);
    if (amount <= 0) { tally.ignored += 1; continue; }

    const outcome =
      target.kind === 'dues'
        ? await recordDuesUnit(order.id, target.seasonMemberId, capture, amount)
        : await recordChargeUnit(order.id, target.chargeId, capture, amount);
    tally[outcome] += 1;
  }
  logger.info(`PayPal order ${order.id} recorded: ${tally.recorded} recorded, ${tally.duplicate} duplicate, ${tally.ignored} ignored`);
  return tally;
}

async function recordDuesUnit(orderId: string, seasonMemberId: string, capture: PayPalCapture, amount: number): Promise<RecordOutcome> {
  const existing = await prisma.payment.findUnique({ where: { processorCheckoutSessionId: capture.id }, select: { id: true } });
  if (existing) return 'duplicate';

  const sm = await prisma.seasonMember.findUnique({
    where: { id: seasonMemberId },
    include: { member: { select: { email: true } }, season: { select: { id: true, duesAmount: true } },
      payments: { where: { type: 'DUES' }, select: { amount: true } } },
  });
  if (!sm) { logger.error(`PayPal order ${orderId} references missing seasonMember ${seasonMemberId}`); return 'ignored'; }

  const feeAmount = valueToCents(capture.seller_receivable_breakdown?.paypal_fee?.value) || null;
  const netAmount = valueToCents(capture.seller_receivable_breakdown?.net_amount?.value) || null;
  const paidBefore = sm.payments.reduce((s, p) => s + p.amount, 0);
  const remainingAfter = duesRemainingCents({
    duesStatus: sm.duesStatus, duesOverrideCents: sm.duesOverrideCents,
    seasonDuesCents: sm.season.duesAmount, duesPaidCents: paidBefore + amount,
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({ data: {
        seasonMemberId, type: 'DUES', amount, method: 'PAYPAL', paidTo: 'PayPal', paidAt: new Date(),
        notes: `PayPal order ${orderId} (capture ${capture.id})`, recordedBy: 'PayPal',
        processor: 'PAYPAL', processorCheckoutSessionId: capture.id, processorPaymentIntentId: capture.id,
        processorPaymentMethodType: 'paypal', feeAmount, netAmount,
      } });
      if (remainingAfter === 0) {
        await tx.application.updateMany({
          where: { seasonId: sm.season.id, email: sm.member.email, status: { in: ['PRE_APPROVED', 'INVITED', 'ACCEPTED'] } },
          data: { status: 'DUES_PAID', duesPaidAt: new Date() },
        });
        await tx.seasonMember.update({ where: { id: seasonMemberId }, data: { duesStatus: 'PAID' } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return 'duplicate';
    throw err;
  }
  logger.info(`Recorded PayPal dues payment (capture ${capture.id}, $${(amount / 100).toFixed(2)}) for seasonMember ${seasonMemberId}${remainingAfter === 0 ? ' — dues now PAID' : ' — partial'}`);
  return 'recorded';
}

async function recordChargeUnit(orderId: string, chargeId: string, capture: PayPalCapture, amount: number): Promise<RecordOutcome> {
  const existing = await prisma.payment.findUnique({ where: { processorCheckoutSessionId: capture.id }, select: { id: true } });
  if (existing) return 'duplicate';

  const charge = await prisma.charge.findUnique({ where: { id: chargeId }, select: { id: true, seasonMemberId: true, status: true, label: true } });
  if (!charge) { logger.error(`PayPal order ${orderId} references missing charge ${chargeId}`); return 'ignored'; }

  const feeAmount = valueToCents(capture.seller_receivable_breakdown?.paypal_fee?.value) || null;
  const netAmount = valueToCents(capture.seller_receivable_breakdown?.net_amount?.value) || null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({ data: {
        seasonMemberId: charge.seasonMemberId, chargeId: charge.id, type: 'OTHER', amount, method: 'PAYPAL',
        paidTo: 'PayPal', paidAt: new Date(), notes: `PayPal order ${orderId} (capture ${capture.id}) — ${charge.label}`,
        recordedBy: 'PayPal', processor: 'PAYPAL', processorCheckoutSessionId: capture.id,
        processorPaymentIntentId: capture.id, processorPaymentMethodType: 'paypal', feeAmount, netAmount,
      } });
      await tx.charge.updateMany({ where: { id: charge.id, status: 'OPEN' }, data: { status: 'PAID', paidAt: new Date() } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return 'duplicate';
    throw err;
  }
  logger.info(`Recorded PayPal charge payment (capture ${capture.id}, $${(amount / 100).toFixed(2)}) for charge ${charge.id} "${charge.label}"`);
  return 'recorded';
}
