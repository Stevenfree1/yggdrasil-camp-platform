'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Banknote,
  RefreshCw,
  AlertCircle,
  Loader2,
  Wallet,
  TrendingUp,
  PiggyBank,
  CheckCircle2,
  Pencil,
  Trash2,
  Lock,
} from 'lucide-react';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';
import { EmptyState } from '../../../components/shared/EmptyState';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { PaymentEditModal, type EditablePayment } from '../../../components/admin/PaymentEditModal';
import { trpc } from '../../../lib/trpc';

// The Payment.type / Payment.method enums (kept in sync with the payments
// router). Used to populate the filter dropdowns.
const PAYMENT_TYPES = [
  'DUES', 'GRID', 'FOOD', 'DONATION', 'RV_VOUCHER',
  'BEER_FUND', 'TENT', 'TICKET', 'STRIKE_DONATION', 'FUNDRAISING', 'OTHER',
] as const;
const PAYMENT_METHODS = [
  'VENMO', 'ZELLE', 'CASH', 'ACH', 'CARD', 'PAYPAL', 'OTHER',
] as const;

type PaymentType = (typeof PAYMENT_TYPES)[number];
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Tokens that should keep a fixed casing instead of Title Case.
const LABEL_OVERRIDES: Record<string, string> = { ACH: 'ACH', RV: 'RV', PAYPAL: 'PayPal' };

function prettyLabel(value: string): string {
  return value
    .split('_')
    .map((w) => LABEL_OVERRIDES[w] ?? w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(value: string | Date | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(value);
  }
}

const PAGE_SIZE = 100;

export default function PaymentsPage() {
  const { selectedSeasonId, selectedSeason } = useAdminSeason();
  const [typeFilter, setTypeFilter] = useState<PaymentType | ''>('');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<EditablePayment | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null);

  const utils = trpc.useContext();
  const invalidate = () => {
    utils.payments.list.invalidate();
    utils.payments.getSummary.invalidate();
  };
  const updateMutation = trpc.payments.update.useMutation({ onSuccess: invalidate });
  const deleteMutation = trpc.payments.delete.useMutation({ onSuccess: invalidate });

  const summaryQuery = trpc.payments.getSummary.useQuery(
    { seasonId: selectedSeasonId ?? '' },
    { enabled: !!selectedSeasonId },
  );

  const listQuery = trpc.payments.list.useQuery(
    {
      seasonId: selectedSeasonId ?? undefined,
      type: typeFilter || undefined,
      method: methodFilter || undefined,
      limit: PAGE_SIZE,
      offset,
    },
    { enabled: !!selectedSeasonId, keepPreviousData: true },
  );

  const summary = summaryQuery.data;
  const payments = listQuery.data?.payments ?? [];
  const total = listQuery.data?.total ?? 0;

  // Sum of the amounts on the page currently shown (the season-wide total lives
  // in the summary card).
  const pageTotal = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );

  const duesPct = summary && summary.duesProgress.expected > 0
    ? Math.round((summary.duesProgress.collected / summary.duesProgress.expected) * 100)
    : 0;

  const anyFilter = !!typeFilter || !!methodFilter;
  const resetOffset = () => setOffset(0);

  if (!selectedSeasonId) {
    return (
      <div className="p-8">
        <EmptyState
          icon={Banknote}
          title="No season selected"
          description="Use the season dropdown in the header to pick a year."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
            Operations Ledger
          </p>
          <h1 className="font-display text-2xl text-ink">
            Payments {selectedSeason ? `· ${selectedSeason.year}` : ''}
          </h1>
        </div>
        <button
          onClick={() => { summaryQuery.refetch(); listQuery.refetch(); }}
          disabled={listQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-md border border-tan/40 px-3 py-1.5 text-sm text-ink-soft hover:text-gold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total collected"
            value={fmtMoney(summary.totalCollected)}
            sub={`${summary.totalPayments} payment${summary.totalPayments === 1 ? '' : 's'}`}
            Icon={Wallet}
          />
          <SummaryCard
            label="Dues collected"
            value={fmtMoney(summary.duesProgress.collected)}
            sub={`of ${fmtMoney(summary.duesProgress.expected)} expected`}
            Icon={PiggyBank}
          />
          <SummaryCard
            label="Dues progress"
            value={`${duesPct}%`}
            sub={`${summary.duesProgress.confirmedMembers} confirmed member${summary.duesProgress.confirmedMembers === 1 ? '' : 's'}`}
            Icon={CheckCircle2}
          />
          <SummaryCard
            label="Avg payment"
            value={fmtMoney(summary.totalPayments > 0 ? Math.round(summary.totalCollected / summary.totalPayments) : 0)}
            sub={`${summary.byMethod.length} method${summary.byMethod.length === 1 ? '' : 's'} used`}
            Icon={TrendingUp}
          />
        </div>
      )}

      {/* Breakdowns by type + method (click a row to filter the log) */}
      {summary && (summary.byType.length > 0 || summary.byMethod.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Breakdown
            title="By type"
            rows={summary.byType.map((t) => ({ key: t.type, label: prettyLabel(t.type), total: t.total, count: t.count }))}
            activeKey={typeFilter}
            onToggle={(k) => { setTypeFilter((cur) => (cur === k ? '' : (k as PaymentType))); resetOffset(); }}
          />
          <Breakdown
            title="By method"
            rows={summary.byMethod.map((m) => ({ key: m.method, label: prettyLabel(m.method), total: m.total, count: m.count }))}
            activeKey={methodFilter}
            onToggle={(k) => { setMethodFilter((cur) => (cur === k ? '' : (k as PaymentMethod))); resetOffset(); }}
          />
        </div>
      )}

      {/* Filters */}
      <div className="luxury-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Type</span>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as PaymentType | ''); resetOffset(); }}
              className="form-input w-auto min-w-[150px] py-1.5 text-sm"
            >
              <option value="">All types</option>
              {PAYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{prettyLabel(t)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Method</span>
            <select
              value={methodFilter}
              onChange={(e) => { setMethodFilter(e.target.value as PaymentMethod | ''); resetOffset(); }}
              className="form-input w-auto min-w-[150px] py-1.5 text-sm"
            >
              <option value="">All methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{prettyLabel(m)}</option>
              ))}
            </select>
          </label>
          {anyFilter && (
            <button
              onClick={() => { setTypeFilter(''); setMethodFilter(''); resetOffset(); }}
              className="text-sm text-gold hover:underline pb-1.5"
            >
              Clear filters ×
            </button>
          )}
        </div>
      </div>

      {/* Delete error */}
      {deleteMutation.error && (
        <div className="luxury-card border-red-500/30 bg-red-50/50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Failed to delete payment</p>
            <p className="text-sm text-red-700">{deleteMutation.error.message}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {listQuery.error && (
        <div className="luxury-card border-red-500/30 bg-red-50/50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Failed to load payments</p>
            <p className="text-sm text-red-700">{listQuery.error.message}</p>
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="luxury-card overflow-hidden">
        {listQuery.isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payments match your filters"
            description={anyFilter ? 'Try clearing filters.' : 'No payments recorded for this season yet.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/30 text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Member</th>
                  <th className="text-left font-medium px-4 py-3">Type</th>
                  <th className="text-left font-medium px-4 py-3">Method</th>
                  <th className="text-right font-medium px-4 py-3">Amount</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Paid to</th>
                  <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Recorded by</th>
                  <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Notes</th>
                  <th className="text-right font-medium px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => {
                  const member = p.seasonMember.member;
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.01, 0.5) }}
                      className="border-b border-tan/15 hover:bg-cream/50"
                    >
                      <td className="px-4 py-2.5 text-ink-soft tabular-nums whitespace-nowrap">
                        {fmtDate(p.paidAt)}
                      </td>
                      <td className="px-4 py-2.5 text-ink">
                        <p className="font-medium truncate max-w-[220px]">
                          {member.name}
                          {member.playaName ? <span className="text-ink-soft font-normal"> · {member.playaName}</span> : null}
                        </p>
                        <p className="text-xs text-ink-soft truncate max-w-[220px]">{member.email}</p>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-sage/5 px-2 py-0.5 text-xs font-medium text-sage">
                          {prettyLabel(p.type)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft whitespace-nowrap">{prettyLabel(p.method)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-ink whitespace-nowrap">
                        {fmtMoney(p.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft whitespace-nowrap hidden md:table-cell">
                        {p.paidTo || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft whitespace-nowrap hidden lg:table-cell">
                        {p.recordedBy || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-ink-soft max-w-xs hidden lg:table-cell">
                        {p.notes ? <p className="truncate text-xs">{p.notes}</p> : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        {p.processor ? (
                          <span
                            className="inline-flex items-center text-ink-soft/40"
                            title="Recorded by a payment processor — locked"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setEditing(p)}
                              className="rounded-md p-1.5 text-ink-soft hover:text-gold hover:bg-cream transition-colors"
                              title="Edit payment"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleting({
                                id: p.id,
                                label: `${fmtMoney(p.amount)} ${prettyLabel(p.type)} from ${member.name}`,
                              })}
                              className="rounded-md p-1.5 text-ink-soft hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete payment"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-tan/30 bg-cream/30">
                  <td colSpan={4} className="px-4 py-3 text-ink-soft text-xs uppercase tracking-[0.14em]">
                    This page · {payments.length} of {total}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-ink">
                    {fmtMoney(pageTotal)}
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="rounded-md border border-tan/40 px-3 py-1.5 text-ink-soft hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-ink-soft">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="rounded-md border border-tan/40 px-3 py-1.5 text-ink-soft hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* Edit modal */}
      <PaymentEditModal
        payment={editing}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          await updateMutation.mutateAsync(input);
        }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate({ id: deleting.id });
        }}
        title="Delete Payment"
        message={`Delete ${deleting?.label ?? 'this payment'}? This removes the ledger entry permanently. If it was the member's only dues payment, their dues status flips back to unpaid.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  Icon,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: typeof Banknote;
}) {
  return (
    <div className="luxury-card p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">{label}</p>
        <Icon className="h-4 w-4 text-ink-soft" />
      </div>
      <p className="font-display text-xl text-ink tabular-nums">{value}</p>
      <p className="text-xs text-ink-soft mt-0.5">{sub}</p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  activeKey,
  onToggle,
}: {
  title: string;
  rows: Array<{ key: string; label: string; total: number; count: number }>;
  activeKey: string;
  onToggle: (key: string) => void;
}) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const max = sorted.reduce((m, r) => Math.max(m, r.total), 0) || 1;
  return (
    <div className="luxury-card p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold mb-3">{title}</p>
      <div className="space-y-1.5">
        {sorted.map((r) => (
          <div key={r.key} className="flex items-center gap-3 text-sm">
            <button
              onClick={() => onToggle(r.key)}
              className={`flex-shrink-0 w-28 truncate text-left transition-colors ${
                activeKey === r.key ? 'text-gold font-medium' : 'text-ink hover:text-gold'
              }`}
            >
              {r.label}
            </button>
            <div className="flex-1 h-1.5 rounded-full bg-tan/20 overflow-hidden">
              <div className="h-full bg-sage transition-all duration-500" style={{ width: `${(r.total / max) * 100}%` }} />
            </div>
            <span className="w-24 text-right text-ink-soft tabular-nums">{fmtMoney(r.total)}</span>
            <span className="w-10 text-right text-ink-soft text-xs tabular-nums">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
