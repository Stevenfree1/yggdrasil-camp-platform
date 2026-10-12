import Stripe from 'stripe';
import { getCampConfig } from '@/lib/config';

type StripeClient = Stripe.Stripe;

let stripeClient: StripeClient | null = null;

export function getAppUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3006' : getCampConfig().website);

  return raw.replace(/\/+$/, '');
}

export function getStripe(): StripeClient {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}
