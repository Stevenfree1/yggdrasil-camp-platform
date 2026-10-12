import { NextResponse } from 'next/server';
import logger from '@/server/lib/logger';
import { isPayPalConfigured, verifyPayPalWebhook } from '@/server/lib/paypal';
import { recordPaidPayPalOrder } from '@/server/lib/paypal-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PayPal webhook receiver — a redundant safety net behind the client capture
 * flow. The signed-in member normally captures their order via tRPC, which
 * records the payment synchronously. This endpoint catches the case where the
 * browser closes after PayPal approval but before the capture call returns.
 *
 * Recording is idempotent on the PayPal order id, so duplicate delivery (here
 * and via the capture path) collapses to a single Payment row.
 */
export async function POST(req: Request) {
  if (!isPayPalConfigured() || !process.env.PAYPAL_WEBHOOK_ID) {
    logger.error('PayPal webhook received but PayPal/PAYPAL_WEBHOOK_ID is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const rawBody = await req.text();

  let verified = false;
  try {
    verified = await verifyPayPalWebhook(req.headers, rawBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`PayPal webhook verification error: ${message}`);
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  if (!verified) {
    logger.warn('PayPal webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: { id?: string; event_type?: string; resource?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = event.resource ?? {};
      const supplementary = resource.supplementary_data as
        | { related_ids?: { order_id?: string } }
        | undefined;
      const orderId = supplementary?.related_ids?.order_id;
      if (orderId) {
        await recordPaidPayPalOrder(orderId);
      } else {
        logger.warn(`PayPal capture webhook ${event.id ?? ''} had no related order_id`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`PayPal webhook ${event.id ?? ''} failed: ${message}`);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
