import { PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import logger from './logger';

type StripeCheckoutSession = {
  id: string;
  amount_total?: number | null;
  customer?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
  payment_intent?: string | { id: string } | null;
  payment_method_types?: string[] | null;
  payment_status?: string | null;
};

function methodFromStripe(session: StripeCheckoutSession): PaymentMethod {
  const methodType = session.payment_method_types?.[0] ?? '';
  if (methodType === 'us_bank_account') return 'ACH';
  return 'CARD';
}

function stringifyStripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

export async function recordPaidStripeCheckoutSession(
  session: StripeCheckoutSession,
): Promise<'recorded' | 'duplicate' | 'ignored'> {
  const paymentType = session.metadata?.paymentType;
  const seasonMemberId = session.metadata?.seasonMemberId;

  if (paymentType !== 'DUES' || !seasonMemberId) {
    return 'ignored';
  }

  if (session.payment_status !== 'paid') {
    logger.info(`Stripe checkout ${session.id} is ${session.payment_status}; payment not recorded yet`);
    return 'ignored';
  }

  const amount = session.amount_total ?? 0;
  if (amount <= 0) {
    logger.warn(`Stripe checkout ${session.id} had no positive amount_total`);
    return 'ignored';
  }

  const existing = await prisma.payment.findUnique({
    where: { processorCheckoutSessionId: session.id },
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
    logger.error(`Stripe checkout ${session.id} references missing seasonMember ${seasonMemberId}`);
    return 'ignored';
  }

  const paymentIntentId = stringifyStripeId(session.payment_intent);
  const customerId = stringifyStripeId(session.customer);
  const method = methodFromStripe(session);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          seasonMemberId,
          type: 'DUES',
          amount,
          method,
          paidTo: 'Stripe',
          paidAt: new Date(),
          notes: `Stripe Checkout ${session.id}`,
          recordedBy: 'Stripe webhook',
          processor: 'STRIPE',
          processorCheckoutSessionId: session.id,
          processorPaymentIntentId: paymentIntentId,
          processorPaymentMethodType: session.payment_method_types?.[0] ?? null,
          processorCustomerId: customerId,
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

  logger.info(`Recorded Stripe dues payment ${session.id} for ${seasonMember.member.email}`);
  return 'recorded';
}
