/**
 * PayPal REST API helper (Orders v2).
 *
 * The camp can collect season dues through PayPal. We talk to the REST API
 * directly with fetch (no SDK) to keep the dependency surface small. The
 * client id / secret / environment come from env vars; nothing is hard-coded.
 *
 * Mirrors the shape of server/lib/stripe.ts: a lazily-configured client that
 * throws a clear error when the required env vars are missing, plus a boolean
 * `isPayPalConfigured()` so callers can degrade gracefully.
 */

type PayPalEnv = 'sandbox' | 'live';

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  env: PayPalEnv;
  baseUrl: string;
  /** Webhook id from the PayPal dashboard; required only for webhook verification. */
  webhookId: string | null;
}

export interface PayPalAmount {
  currency_code: string;
  value: string;
}

export interface PayPalCapture {
  id: string;
  status: string;
  amount?: PayPalAmount;
  seller_receivable_breakdown?: {
    paypal_fee?: PayPalAmount;
    net_amount?: PayPalAmount;
  };
}

export interface PayPalPurchaseUnit {
  reference_id?: string;
  custom_id?: string;
  description?: string;
  amount?: PayPalAmount;
  payments?: { captures?: PayPalCapture[] };
}

export interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: PayPalPurchaseUnit[];
}

const PAYPAL_BASE_URLS: Record<PayPalEnv, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

/** Cached OAuth token, refreshed shortly before expiry. */
let tokenCache: { token: string; expiresAt: number } | null = null;

function readEnv(): PayPalConfig | null {
  // Server can reuse the public client id so only the secret is server-only.
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const env: PayPalEnv = process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';

  return {
    clientId,
    clientSecret,
    env,
    baseUrl: PAYPAL_BASE_URLS[env],
    webhookId: process.env.PAYPAL_WEBHOOK_ID || null,
  };
}

export function isPayPalConfigured(): boolean {
  return readEnv() !== null;
}

export function getPayPalConfig(): PayPalConfig {
  const config = readEnv();
  if (!config) {
    throw new Error('PayPal is not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing)');
  }
  return config;
}

async function getAccessToken(): Promise<string> {
  const config = getPayPalConfig();

  // Reuse the cached token while it has at least 60s of life left.
  if (tokenCache && tokenCache.expiresAt - 60_000 > nowMs()) {
    return tokenCache.token;
  }

  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const res = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`PayPal token request failed: ${res.status} ${await safeText(res)}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: nowMs() + data.expires_in * 1000,
  };
  return data.access_token;
}

async function paypalFetch<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  const config = getPayPalConfig();
  const token = await getAccessToken();

  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!res.ok) {
    throw new Error(`PayPal ${init.method} ${path} failed: ${res.status} ${await safeText(res)}`);
  }

  return (await res.json()) as T;
}

/** Convert integer cents to the decimal string PayPal expects ("123.45"). */
function centsToValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Convert a PayPal decimal string ("123.45") back to integer cents. */
export function valueToCents(value: string | undefined): number {
  if (!value) return 0;
  return Math.round(parseFloat(value) * 100);
}

export async function createPayPalOrder(params: {
  amountCents: number;
  referenceId: string;
  description: string;
}): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.referenceId,
          custom_id: params.referenceId,
          description: params.description.slice(0, 127),
          amount: {
            currency_code: 'USD',
            value: centsToValue(params.amountCents),
          },
        },
      ],
    },
  });
}

export interface PayPalUnitInput {
  customId: string;     // encodes the target (see lib/pay-targets.ts)
  description: string;
  amountCents: number;
}

/** Create a CAPTURE order with one purchase unit per target. */
export async function createPayPalOrderWithUnits(units: PayPalUnitInput[]): Promise<PayPalOrder> {
  if (units.length === 0) throw new Error('createPayPalOrderWithUnits: no units');
  return paypalFetch<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: units.map((u, i) => ({
        reference_id: String(i),
        custom_id: u.customId,
        description: u.description.slice(0, 127),
        amount: { currency_code: 'USD', value: centsToValue(u.amountCents) },
      })),
    },
  });
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    body: {},
  });
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${orderId}`, { method: 'GET' });
}

/**
 * Verify a webhook event came from PayPal using the dashboard webhook id.
 * Returns false (rather than throwing) when verification cannot be performed.
 */
export async function verifyPayPalWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const config = getPayPalConfig();
  if (!config.webhookId) return false;

  const transmissionId = headers.get('paypal-transmission-id');
  const transmissionTime = headers.get('paypal-transmission-time');
  const certUrl = headers.get('paypal-cert-url');
  const authAlgo = headers.get('paypal-auth-algo');
  const transmissionSig = headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false;
  }

  let webhookEvent: unknown;
  try {
    webhookEvent = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const result = await paypalFetch<{ verification_status: string }>(
    '/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      body: {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: config.webhookId,
        webhook_event: webhookEvent,
      },
    },
  );

  return result.verification_status === 'SUCCESS';
}

// Date.now() is wrapped so the rest of the module reads cleanly; token caching
// is the only place we need wall-clock time.
function nowMs(): number {
  return Date.now();
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}
