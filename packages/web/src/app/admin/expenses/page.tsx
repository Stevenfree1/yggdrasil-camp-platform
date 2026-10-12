'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  RefreshCw,
  Search,
  AlertCircle,
  Loader2,
  Receipt,
  TrendingDown,
} from 'lucide-react';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';
import { EmptyState } from '../../../components/shared/EmptyState';
import {
  fetchExpenses,
  fetchExpenseSummary,
  type Expense,
  type ExpenseSummary,
} from '../../../lib/adminApi';

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ExpensesPage() {
  const { selectedSeasonId, selectedSeason } = useAdminSeason();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [paidByFilter, setPaidByFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const limit = 100;

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const load = useCallback(async () => {
    if (!selectedSeasonId) return;
    setLoading(true);
    setError(null);
    try {
      const [listResult, summaryResult] = await Promise.all([
        fetchExpenses({
          seasonId: selectedSeasonId,
          search: debouncedSearch || undefined,
          paidBy: paidByFilter || undefined,
          limit,
          offset,
        }),
        fetchExpenseSummary(selectedSeasonId),
      ]);
      setExpenses(listResult.expenses);
      setTotal(listResult.total);
      setTotalAmount(listResult.totalAmount);
      setSummary(summaryResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [selectedSeasonId, debouncedSearch, paidByFilter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, paidByFilter, selectedSeasonId]);

  const topPaidBy = useMemo(() => {
    if (!summary) return [];
    return summary.byPaidBy.slice(0, 8);
  }, [summary]);

  if (!selectedSeasonId) {
    return (
      <div className="p-8">
        <EmptyState
          icon={DollarSign}
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
            Expenses {selectedSeason ? `· ${selectedSeason.year}` : ''}
          </h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-tan/40 px-3 py-1.5 text-sm text-ink-soft hover:text-gold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total expenses"
            value={fmtMoney(summary.total.amount)}
            sub={`${summary.total.count} entries`}
            Icon={TrendingDown}
          />
          <SummaryCard
            label="Distinct payers"
            value={String(summary.byPaidBy.length)}
            sub="people / accounts"
            Icon={DollarSign}
          />
          <SummaryCard
            label="Needs reimbursement"
            value={(() => {
              const r = summary.reimbursementStatus.find(
                (s) => s.needsReimbursement && !s.reimbursed,
              );
              return r ? fmtMoney(r._sum.amount ?? 0) : '$0.00';
            })()}
            sub="owed to members"
            Icon={Receipt}
          />
          <SummaryCard
            label="Uncategorized"
            value={(() => {
              const u = summary.byCategory.find((c) => !c.category);
              return u ? String(u.count) : '0';
            })()}
            sub="needs category tag"
            Icon={AlertCircle}
          />
        </div>
      )}

      {/* Top payers breakdown */}
      {topPaidBy.length > 0 && (
        <div className="luxury-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold mb-3">
            Top contributors (by amount paid)
          </p>
          <div className="space-y-1.5">
            {topPaidBy.map((p) => {
              const pct = summary && summary.total.amount > 0
                ? (p.amount / summary.total.amount) * 100
                : 0;
              return (
                <div key={p.paidBy} className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => setPaidByFilter(p.paidBy === paidByFilter ? '' : p.paidBy)}
                    className={`flex-shrink-0 w-32 truncate text-left transition-colors ${
                      paidByFilter === p.paidBy ? 'text-gold font-medium' : 'text-ink hover:text-gold'
                    }`}
                  >
                    {p.paidBy}
                  </button>
                  <div className="flex-1 h-1.5 rounded-full bg-tan/20 overflow-hidden">
                    <div
                      className="h-full bg-sage transition-all duration-500"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="w-28 text-right text-ink-soft tabular-nums">
                    {fmtMoney(p.amount)}
                  </span>
                  <span className="w-12 text-right text-ink-soft text-xs tabular-nums">
                    {p.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="luxury-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description or notes…"
              className="form-input w-full pl-9"
            />
          </div>
          {paidByFilter && (
            <button
              onClick={() => setPaidByFilter('')}
              className="text-sm text-gold hover:underline"
            >
              Clear paid-by filter ({paidByFilter}) ×
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="luxury-card border-red-500/30 bg-red-50/50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Failed to load expenses</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* List */}
      <div className="luxury-card overflow-hidden">
        {loading && expenses.length === 0 ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses match your filters"
            description={debouncedSearch || paidByFilter ? 'Try clearing filters.' : 'No expenses recorded for this season yet.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/30 text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Description</th>
                  <th className="text-left font-medium px-4 py-3">Paid by</th>
                  <th className="text-right font-medium px-4 py-3">Amount</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, i) => (
                  <motion.tr
                    key={e.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.5) }}
                    className="border-b border-tan/15 hover:bg-cream/50"
                  >
                    <td className="px-4 py-2.5 text-ink-soft tabular-nums whitespace-nowrap">
                      {fmtDate(e.date)}
                    </td>
                    <td className="px-4 py-2.5 text-ink max-w-md">
                      <p className="truncate">{e.description}</p>
                    </td>
                    <td className="px-4 py-2.5 text-ink whitespace-nowrap">{e.paidBy}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-ink whitespace-nowrap">
                      {fmtMoney(e.amount)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {e.reimbursed ? (
                        <span className="text-xs text-sage">Reimbursed</span>
                      ) : e.needsReimbursement ? (
                        <span className="text-xs text-gold">Needs reimb.</span>
                      ) : (
                        <span className="text-xs text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft max-w-xs">
                      {e.notes && <p className="truncate text-xs">{e.notes}</p>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-tan/30 bg-cream/30">
                  <td colSpan={3} className="px-4 py-3 text-ink-soft text-xs uppercase tracking-[0.14em]">
                    Showing {expenses.length} of {total}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-ink">
                    {fmtMoney(totalAmount)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="rounded-md border border-tan/40 px-3 py-1.5 text-ink-soft hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-ink-soft">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="rounded-md border border-tan/40 px-3 py-1.5 text-ink-soft hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
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
  Icon: typeof DollarSign;
}) {
  return (
    <div className="luxury-card p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
          {label}
        </p>
        <Icon className="h-4 w-4 text-ink-soft" />
      </div>
      <p className="font-display text-xl text-ink tabular-nums">{value}</p>
      <p className="text-xs text-ink-soft mt-0.5">{sub}</p>
    </div>
  );
}
