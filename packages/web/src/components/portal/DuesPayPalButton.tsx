'use client';

import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { AlertCircle, Loader2 } from 'lucide-react';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

/**
 * PayPal Smart Buttons for paying remaining season dues.
 *
 * The order amount is computed entirely server-side: createOrder calls our
 * tRPC `createDuesPayPalOrder`, and onApprove calls `captureDuesPayPalOrder`,
 * which captures and records the payment. Raw fetch is used (matching the rest
 * of the portal page) with superjson's `{ json: ... }` request wrapping.
 *
 * Renders nothing if NEXT_PUBLIC_PAYPAL_CLIENT_ID is unset, so the parent can
 * fall back to an offline-payment note.
 */
export function DuesPayPalButton({ onPaid }: { onPaid: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  if (!PAYPAL_CLIENT_ID) return null;

  return (
    <div className="max-w-sm">
      <PayPalScriptProvider
        options={{ clientId: PAYPAL_CLIENT_ID, currency: 'USD', intent: 'capture' }}
      >
        <PayPalButtons
          style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
          disabled={processing}
          createOrder={async () => {
            setError(null);
            const res = await fetch('/api/trpc/payments.createDuesPayPalOrder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ json: {} }),
            });
            const json = await res.json();
            if (!res.ok || json.error) {
              const message =
                json.error?.json?.message || json.error?.message || 'Could not start PayPal checkout.';
              setError(message);
              throw new Error(message);
            }
            const orderId: string | undefined = json.result?.data?.json?.orderId;
            if (!orderId) {
              const message = 'PayPal did not return an order id.';
              setError(message);
              throw new Error(message);
            }
            return orderId;
          }}
          onApprove={async (data) => {
            setProcessing(true);
            setError(null);
            try {
              const res = await fetch('/api/trpc/payments.captureDuesPayPalOrder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ json: { orderId: data.orderID } }),
              });
              const json = await res.json();
              if (!res.ok || json.error) {
                throw new Error(
                  json.error?.json?.message ||
                    json.error?.message ||
                    'PayPal payment could not be completed.',
                );
              }
              onPaid();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'PayPal payment could not be completed.',
              );
            } finally {
              setProcessing(false);
            }
          }}
          onError={() => {
            setError('PayPal encountered an error. Please try again.');
          }}
        />
      </PayPalScriptProvider>

      {processing && (
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" />
          Confirming your payment…
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-2 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
