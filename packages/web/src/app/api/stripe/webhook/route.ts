import { NextResponse } from 'next/server';
import { getStripe } from '@/server/lib/stripe';
import logger from '@/server/lib/logger';
import { recordPaidStripeCheckoutSession } from '@/server/lib/stripe-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  const payload = await req.text();
  let event: {
    id: string;
    type: string;
    data: { object: unknown };
  };

  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Invalid Stripe webhook signature: ${message}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Parameters<typeof recordPaidStripeCheckoutSession>[0];
      await recordPaidStripeCheckoutSession(session);
    } else if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as { id?: string };
      logger.warn(`Stripe checkout async payment failed: ${session.id ?? 'unknown session'}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Stripe webhook ${event.id} failed: ${message}`);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
