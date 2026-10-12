'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Pencil, AlertCircle } from 'lucide-react';

export const PAYMENT_TYPE_OPTIONS = [
  'DUES', 'GRID', 'FOOD', 'DONATION', 'RV_VOUCHER',
  'BEER_FUND', 'TENT', 'TICKET', 'STRIKE_DONATION', 'FUNDRAISING', 'OTHER',
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  'VENMO', 'ZELLE', 'CASH', 'ACH', 'CARD', 'PAYPAL', 'OTHER',
] as const;

export type PaymentTypeOption = (typeof PAYMENT_TYPE_OPTIONS)[number];
export type PaymentMethodOption = (typeof PAYMENT_METHOD_OPTIONS)[number];

const LABEL_OVERRIDES: Record<string, string> = { ACH: 'ACH', RV: 'RV', PAYPAL: 'PayPal' };

export function paymentLabel(value: string): string {
  return value
    .split('_')
    .map((w) => LABEL_OVERRIDES[w] ?? w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export interface EditablePayment {
  id: string;
  type: string;
  amount: number; // cents
  method: string;
  paidTo?: string | null;
  paidAt: string | Date;
  notes?: string | null;
}

export interface PaymentUpdateInput {
  id: string;
  type: PaymentTypeOption;
  amount: number; // cents
  method: PaymentMethodOption;
  paidTo: string | null;
  paidAt: string; // ISO datetime
  notes: string | null;
}

interface PaymentEditModalProps {
  payment: EditablePayment | null; // null = closed
  onClose: () => void;
  onSave: (input: PaymentUpdateInput) => Promise<void>;
}

/**
 * Edit form for a manually entered payment. Processor-recorded payments
 * (Stripe/PayPal) are locked server-side; callers should not open this
 * modal for them.
 */
export function PaymentEditModal({ payment, onClose, onSave }: PaymentEditModalProps) {
  const [type, setType] = useState<PaymentTypeOption>('DUES');
  const [method, setMethod] = useState<PaymentMethodOption>('VENMO');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Original calendar date, used to preserve the exact timestamp when the
  // admin doesn't touch the date field.
  const originalDate = payment ? toDateInputValue(payment.paidAt) : '';

  useEffect(() => {
    if (!payment) return;
    setType(payment.type as PaymentTypeOption);
    setMethod(payment.method as PaymentMethodOption);
    setAmount((payment.amount / 100).toFixed(2));
    setDate(toDateInputValue(payment.paidAt));
    setPaidTo(payment.paidTo || '');
    setNotes(payment.notes || '');
    setError(null);
    setSaving(false);
  }, [payment]);

  useEffect(() => {
    if (!payment) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [payment, onClose]);

  const amountCents = Math.round(parseFloat(amount) * 100);
  const amountValid = Number.isFinite(amountCents) && amountCents >= 1 && amountCents <= 100_000_00;
  const canSave = !!payment && amountValid && !!date && !saving;

  const handleSave = async () => {
    if (!payment || !canSave) return;
    try {
      setSaving(true);
      setError(null);
      await onSave({
        id: payment.id,
        type,
        amount: amountCents,
        method,
        paidTo: paidTo.trim() || null,
        // Keep the original timestamp unless the date was actually changed.
        paidAt: date === originalDate
          ? new Date(payment.paidAt).toISOString()
          : new Date(`${date}T12:00:00`).toISOString(),
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative mx-4 w-full max-w-lg luxury-card p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-edit-title"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gold/10 border border-gold/30">
                <Pencil className="h-5 w-5 text-gold" />
              </div>
              <h3 id="payment-edit-title" className="text-display-thin text-lg text-ink">
                Edit Payment
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as PaymentTypeOption)} className="form-input">
                  {PAYMENT_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{paymentLabel(t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethodOption)} className="form-input">
                  {PAYMENT_METHOD_OPTIONS.map((m) => (
                    <option key={m} value={m}>{paymentLabel(m)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Date Paid</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Paid To</label>
                <input
                  type="text"
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  placeholder="Who received it (optional)"
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="form-input"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                disabled={saving}
                className="rounded-md border border-tan/40 px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-cream disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="rounded-md bg-sage px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sage/90 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function toDateInputValue(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
