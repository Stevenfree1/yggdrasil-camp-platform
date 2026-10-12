'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { CreditCard, Loader2, AlertCircle, DollarSign, Receipt, Plus, Trash2, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PayButton, type PayLine } from '../../../components/portal/PayButton';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

interface Payment {
  id: string;
  amount: number;
  type: string;
  method: string;
  paidAt: string;
  note?: string | null;
}

interface Charge {
  id: string;
  itemId: string | null;
  label: string;
  amountCents: number;
  status: string;
  source: string;
}

interface SeasonStatus {
  id: string;
  status: string;
  payments: Payment[];
  charges: Charge[];
  tab?: {
    duesRemainingCents: number;
    openChargesTotalCents: number;
    balanceCents: number;
  };
  season: {
    id: string;
    year: number;
    name: string;
    duesAmount: number;
  };
}

const typeLabels: Record<string, string> = {
  DUES: 'Camp Dues',
  CAMP_DUES: 'Camp Dues',
  EARLY_ARRIVAL: 'Early Arrival',
  RV_FEE: 'RV Fee',
  GRID: 'Grid',
  FOOD: 'Food',
  DONATION: 'Donation',
  RV_VOUCHER: 'RV Voucher',
  BEER_FUND: 'Beer Fund',
  TENT: 'Tent',
  TICKET: 'Ticket',
  STRIKE_DONATION: 'Strike Donation',
  FUNDRAISING: 'Fundraising',
  OTHER: 'Other',
};

const methodLabels: Record<string, string> = {
  CASH: 'Cash',
  ACH: 'Bank Account',
  ZELLE: 'Zelle',
  VENMO: 'Venmo',
  CHECK: 'Check',
  PAYPAL: 'PayPal',
  CARD: 'Card',
  CREDIT_CARD: 'Credit Card',
  OTHER: 'Other',
};

export default function PortalPaymentsPage() {
  const { user } = useAuth();
  const [seasonStatus, setSeasonStatus] = useState<SeasonStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<{ id: string; name: string; description?: string | null; amountCents: number }[]>([]);
  const [partialDues, setPartialDues] = useState('');
  // The single thing currently being paid (one PayPal widget at a time, centered).
  const [payTarget, setPayTarget] = useState<{ label: string; lines: PayLine[] } | null>(null);

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/trpc/seasonMembers.getMySeasonStatus`);
      if (!res.ok) throw new Error('Failed to load payment data');
      const json = await res.json();
      setSeasonStatus(json.result?.data?.json ?? null);
    } catch {
      setError('Unable to load payment data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePaid = useCallback(() => {
    toast.success('Payment received — thank you!');
    loadPayments();
  }, [loadPayments]);

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch('/api/trpc/charges.myAvailableItems');
      const json = await res.json();
      setItems(json.result?.data?.json ?? []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function addItem(itemId: string) {
    const res = await fetch('/api/trpc/charges.addSelfServe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { itemId } }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j.error) {
        toast.error(j.error?.json?.message || 'Could not add that item');
      } else {
        toast.success('Added to your tab');
        loadPayments();
      }
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error?.json?.message || 'Could not add that item');
    }
  }

  async function removeCharge(chargeId: string) {
    const res = await fetch('/api/trpc/charges.removeMine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { chargeId } }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j.error) {
        toast.error(j.error?.json?.message || 'Could not remove that item');
      } else {
        toast.success('Removed from your tab');
        loadPayments();
      }
    } else {
      toast.error('Could not remove that item');
    }
  }

  if (!user) return null;

  const payments = seasonStatus?.payments ?? [];
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const duesPaid = payments
    .filter((p) => p.type === 'DUES' || p.type === 'CAMP_DUES')
    .reduce((sum, p) => sum + p.amount, 0);
  const duesAmount = seasonStatus?.season?.duesAmount ?? 0;
  const remaining = Math.max(0, duesAmount - duesPaid);

  // Money formatter
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // Derived tab values
  const openCharges: Charge[] = (seasonStatus?.charges ?? []).filter((c) => c.status === 'OPEN');
  const duesRemaining = seasonStatus?.tab?.duesRemainingCents ?? remaining;
  const balance = seasonStatus?.tab?.balanceCents ?? duesRemaining;

  // All lines for full-balance pay
  const allLines: PayLine[] = [
    ...(duesRemaining > 0 ? [{ kind: 'dues' as const }] : []),
    ...openCharges.map((c) => ({ kind: 'charge' as const, chargeId: c.id })),
  ];

  // Partial dues: parse to cents, validate. A member may pay MORE than they owe
  // (an over-payment simply drives the remaining to 0), so the only upper bound
  // is a sanity cap matching the server's payLineSchema.
  const MAX_DUES_PAYMENT_CENTS = 100_000_00;
  const partialCents = Math.round(parseFloat(partialDues) * 100);
  const partialValid =
    !isNaN(partialCents) && partialCents > 0 && partialCents <= MAX_DUES_PAYMENT_CENTS;

  // Items already on the tab (to optionally hide from add list)
  const openItemIds = new Set(openCharges.map((c) => c.itemId).filter(Boolean));

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-display-thin text-3xl text-ink mb-2">My Payments</h1>
        <p className="text-body-relaxed text-ink-soft">
          {seasonStatus?.season
            ? `Payment history for ${seasonStatus.season.name}`
            : 'Track your dues and payment history.'}
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
          <button
            onClick={loadPayments}
            className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Loading payment data...</p>
        </div>
      ) : !seasonStatus ? (
        <div className="luxury-card p-6">
          <div className="text-center py-8">
            <CreditCard className="h-10 w-10 text-ink-soft/30 mx-auto mb-3" />
            <p className="text-sm text-ink-soft">
              You are not enrolled in the current season. No payment data available.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Payment summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="luxury-card p-5">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-ink-soft">Total Paid</p>
              </div>
              <p className="text-2xl font-semibold text-ink tabular-nums">
                {(totalPaid / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </p>
            </div>

            <div className="luxury-card p-5">
              <div className="flex items-center gap-3 mb-2">
                <Receipt className="h-5 w-5 text-gold" />
                <p className="text-sm font-medium text-ink-soft">Season Dues</p>
              </div>
              <p className="text-2xl font-semibold text-ink tabular-nums">
                {(duesAmount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </p>
            </div>

            <div className="luxury-card p-5">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="h-5 w-5 text-amber-600" />
                <p className="text-sm font-medium text-ink-soft">Remaining</p>
              </div>
              <p
                className={`text-2xl font-semibold tabular-nums ${
                  duesRemaining > 0 ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                {fmt(duesRemaining)}
              </p>
            </div>
          </div>

          {/* ── What you owe — unified tab card ── */}
          <div className="luxury-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="h-5 w-5 text-gold" />
              <h2 className="text-display-thin text-xl text-ink">
                What you owe — {seasonStatus.season.name}
              </h2>
            </div>

            {balance === 0 ? (
              /* All paid up */
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
                <p className="text-base font-medium text-green-700">You&apos;re all paid up!</p>
                <p className="text-sm text-ink-soft mt-1">
                  No outstanding dues or charges for this season.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Line items — a clean read-only list; paying happens in one panel below */}
                <div className="divide-y divide-sage/10">
                  {/* Dues row */}
                  {duesRemaining > 0 && (
                    <div className="py-3 first:pt-0">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">Season dues</p>
                          {duesPaid > 0 && (
                            <p className="text-xs text-ink-soft mt-0.5">{fmt(duesPaid)} paid so far</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-lg font-semibold text-ink tabular-nums">
                            {fmt(duesRemaining)}
                          </span>
                          {PAYPAL_CLIENT_ID && (
                            <button
                              onClick={() => setPayTarget({ label: 'Season dues', lines: [{ kind: 'dues' }] })}
                              className="cta-secondary text-sm px-4 py-1.5"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Custom amount — compact inline */}
                      {PAYPAL_CLIENT_ID && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-ink-soft">or pay a custom amount:</span>
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
                              $
                            </span>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              placeholder="0.00"
                              value={partialDues}
                              onChange={(e) => setPartialDues(e.target.value)}
                              className="form-input pl-6 w-full text-sm py-1.5"
                            />
                          </div>
                          <button
                            disabled={!partialValid}
                            onClick={() =>
                              setPayTarget({
                                label: `Dues — ${fmt(partialCents)}`,
                                lines: [{ kind: 'dues', amountCents: partialCents }],
                              })
                            }
                            className="cta-secondary text-sm px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Pay
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Charge rows */}
                  {openCharges.map((charge) => (
                    <div key={charge.id} className="py-3 first:pt-0">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{charge.label}</p>
                          {charge.source === 'SELF' && (
                            <button
                              onClick={() => removeCharge(charge.id)}
                              className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-red-600 transition-colors mt-0.5"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-lg font-semibold text-ink tabular-nums">
                            {fmt(charge.amountCents)}
                          </span>
                          {PAYPAL_CLIENT_ID && (
                            <button
                              onClick={() =>
                                setPayTarget({
                                  label: charge.label,
                                  lines: [{ kind: 'charge', chargeId: charge.id }],
                                })
                              }
                              className="cta-secondary text-sm px-4 py-1.5"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Balance total + full-balance action */}
                <div className="border-t border-sage/20 pt-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-ink-soft uppercase tracking-wider">
                      Total balance
                    </p>
                    <p className="text-3xl font-semibold text-amber-600 tabular-nums mt-1">
                      {fmt(balance)}
                    </p>
                  </div>

                  {PAYPAL_CLIENT_ID ? (
                    allLines.length > 1 && (
                      <button
                        onClick={() => setPayTarget({ label: 'Full balance', lines: allLines })}
                        className="cta-primary text-sm px-5 py-2.5"
                      >
                        Pay full balance
                      </button>
                    )
                  ) : (
                    <p className="text-sm text-ink-soft max-w-xs">
                      Online payment is being set up. Reach out to your camp lead to arrange
                      payment — your balance will always appear here.
                    </p>
                  )}
                </div>

                {/* Single, centered PayPal panel — only one widget on the page at a time */}
                {PAYPAL_CLIENT_ID && payTarget && (
                  <div className="mx-auto mt-2 w-full max-w-sm rounded-xl border border-gold/30 bg-cream/50 p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">
                        Paying: <span className="text-ink-soft">{payTarget.label}</span>
                      </p>
                      <button
                        onClick={() => setPayTarget(null)}
                        aria-label="Cancel"
                        className="text-ink-soft transition-colors hover:text-ink"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <PayButton
                      key={JSON.stringify(payTarget.lines)}
                      lines={payTarget.lines}
                      onPaid={() => {
                        setPayTarget(null);
                        setPartialDues('');
                        handlePaid();
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Add to your tab ── */}
          {items.filter((item) => !openItemIds.has(item.id)).length > 0 && (
            <div className="luxury-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <Plus className="h-5 w-5 text-gold" />
                <h2 className="text-display-thin text-xl text-ink">Add to your tab</h2>
              </div>
              <div className="divide-y divide-sage/10">
                {items
                  .filter((item) => !openItemIds.has(item.id))
                  .map((item) => (
                    <div
                      key={item.id}
                      className="py-4 first:pt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-ink-soft mt-0.5">{item.description}</p>
                        )}
                        <p className="text-base font-semibold text-ink tabular-nums mt-1">
                          {fmt(item.amountCents)}
                        </p>
                      </div>
                      <button
                        onClick={() => addItem(item.id)}
                        className="cta-secondary inline-flex items-center gap-2 text-sm shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── Payment history table ── */}
          <div className="luxury-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="h-5 w-5 text-gold" />
              <h2 className="text-display-thin text-xl text-ink">Payment History</h2>
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-10 w-10 text-ink-soft/30 mx-auto mb-3" />
                <p className="text-sm text-ink-soft">No payments recorded yet for this season.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-sage/10">
                      <th className="text-left py-3 px-2 text-xs font-medium text-ink-soft uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-ink-soft uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-ink-soft uppercase tracking-wider hidden sm:table-cell">
                        Method
                      </th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-ink-soft uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-sage/5 hover:bg-sage/[0.03] transition-colors"
                      >
                        <td className="py-3 px-2 text-ink-soft">
                          {new Date(payment.paidAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center rounded-md bg-sage/5 px-2 py-0.5 text-xs font-medium text-sage">
                            {typeLabels[payment.type] || payment.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-ink-soft hidden sm:table-cell">
                          {methodLabels[payment.method] || payment.method}
                        </td>
                        <td className="py-3 px-2 text-right text-ink font-medium tabular-nums">
                          {(payment.amount / 100).toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-sage/20">
                      <td colSpan={2} className="py-3 px-2 text-sm font-medium text-ink">
                        Total
                      </td>
                      <td className="py-3 px-2 hidden sm:table-cell" />
                      <td className="py-3 px-2 text-right text-ink font-semibold tabular-nums">
                        {(totalPaid / 100).toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
