'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Edit3, X, Save, Loader2 } from 'lucide-react';
import { trpc } from '../../../lib/trpc';

type BudgetCategory =
  | 'GENERATOR' | 'FUEL' | 'STORAGE' | 'TRUCKS' | 'SOUND' | 'FOOD' | 'CONTAINERS'
  | 'BATHROOMS' | 'WATER' | 'GREY_WATER' | 'SHOWERS' | 'DECORATION' | 'TRASH'
  | 'SUPPLIES' | 'ART' | 'INFRASTRUCTURE' | 'MISC';

const CAT_LABELS: Record<BudgetCategory, string> = {
  GENERATOR: 'Generator',
  FUEL: 'Generator Fuel',
  STORAGE: 'Storage / Containers Transport',
  TRUCKS: 'Truck Rentals',
  SOUND: 'Sound Equipment',
  FOOD: 'Food',
  CONTAINERS: 'Containers',
  BATHROOMS: 'Bathrooms',
  WATER: 'Water (potable)',
  GREY_WATER: 'Grey Water',
  SHOWERS: 'Showers',
  DECORATION: 'Decoration',
  TRASH: 'Trash / Dumpster',
  SUPPLIES: 'Supplies',
  ART: 'Art Cars / Stage',
  INFRASTRUCTURE: 'Infrastructure (shade, AC, tents)',
  MISC: 'Miscellaneous',
};

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null || cents === 0) return '—';
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

interface EditState {
  open: boolean;
  seasonId: string | null;
  year: number | null;
  category: BudgetCategory | null;
  estimated: string;
  actual: string;
  description: string;
  notes: string;
}

const EMPTY_EDIT: EditState = {
  open: false,
  seasonId: null,
  year: null,
  category: null,
  estimated: '',
  actual: '',
  description: '',
  notes: '',
};

export default function BudgetPage() {
  const compare = trpc.budgets.compare.useQuery({});
  const utils = trpc.useContext();
  const [edit, setEdit] = useState<EditState>(EMPTY_EDIT);

  const upsert = trpc.budgets.upsert.useMutation({
    onSuccess: () => {
      utils.budgets.compare.invalidate();
      setEdit(EMPTY_EDIT);
    },
  });

  const data = compare.data;

  const openEdit = (seasonId: string, year: number, category: BudgetCategory) => {
    if (!data) return;
    const cell = data.matrix[category]?.[year];
    setEdit({
      open: true,
      seasonId,
      year,
      category,
      estimated: cell ? (cell.estimated / 100).toString() : '',
      actual: cell?.actual != null ? (cell.actual / 100).toString() : '',
      description: cell?.description ?? '',
      notes: cell?.notes ?? '',
    });
  };

  const handleSave = () => {
    if (!edit.seasonId || !edit.category) return;
    const estimatedCents = Math.round(Number(edit.estimated) * 100);
    if (!Number.isFinite(estimatedCents) || estimatedCents < 0) return;
    const actualCents = edit.actual.trim() ? Math.round(Number(edit.actual) * 100) : null;
    upsert.mutate({
      seasonId: edit.seasonId,
      category: edit.category,
      description: edit.description.trim() || null,
      estimatedAmount: estimatedCents,
      actualAmount: actualCents,
      notes: edit.notes.trim() || null,
    });
  };

  return (
    <div className="section-base">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-caption text-sage">Camp Finance</div>
            <h1 className="text-optical-h1 text-ink font-display">Budget</h1>
            <p className="text-body-relaxed mt-2 text-ink/70">
              Multi-year line-item budget tracking. Estimates from historical Master Documents; actuals fill in as the season progresses.
            </p>
          </div>
        </header>

        {compare.isLoading && (
          <div className="flex items-center gap-2 text-ink/60">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading budget data…
          </div>
        )}

        {compare.error && (
          <div className="luxury-card border-red-300 text-red-700 p-4">
            Failed to load budgets: {compare.error.message}
          </div>
        )}

        {data && data.seasons.length === 0 && (
          <div className="luxury-card p-8 text-center text-ink/60">No budget data yet.</div>
        )}

        {data && data.seasons.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="luxury-card overflow-x-auto"
            >
              <table className="min-w-full text-sm">
                <thead className="bg-cream/60 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-display text-ink text-base font-normal">
                      Category
                    </th>
                    {data.seasons.map((s) => (
                      <th key={s.id} className="text-right px-4 py-3 font-display text-ink text-base font-normal whitespace-nowrap">
                        {s.year}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-border">
                  {data.categories.map((cat) => {
                    const lifetime = data.seasons.reduce(
                      (sum, s) => sum + (data.matrix[cat]?.[s.year]?.estimated ?? 0),
                      0,
                    );
                    if (lifetime === 0) return null; // hide rows with no data anywhere
                    return (
                      <tr key={cat} className="hover:bg-cream/40">
                        <td className="px-4 py-2.5 text-ink font-medium whitespace-nowrap">
                          {CAT_LABELS[cat]}
                        </td>
                        {data.seasons.map((s) => {
                          const cell = data.matrix[cat]?.[s.year];
                          const hasData = !!cell;
                          return (
                            <td
                              key={s.id}
                              className={`px-4 py-2.5 text-right font-mono ${hasData ? 'text-ink' : 'text-ink/30'}`}
                            >
                              <button
                                type="button"
                                onClick={() => openEdit(s.id, s.year, cat)}
                                className="group inline-flex items-center gap-1.5 hover:text-gold"
                                title={cell?.notes ?? cell?.description ?? 'Click to edit'}
                              >
                                <span>{fmtMoney(cell?.estimated)}</span>
                                {cell?.actual != null && cell.actual !== cell.estimated && (
                                  <span className="text-xs text-sage/70" title="Actual">
                                    ({fmtMoney(cell.actual)})
                                  </span>
                                )}
                                <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="border-t-2 border-warm-border bg-cream/40 font-display">
                    <td className="px-4 py-3 text-ink">Total estimated</td>
                    {data.seasons.map((s) => (
                      <td key={s.id} className="px-4 py-3 text-right font-mono text-ink">
                        {fmtMoney(data.totalsByYear[s.year]?.estimated)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </motion.div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.seasons.slice(-3).map((s) => (
                <div key={s.id} className="luxury-card p-4">
                  <div className="text-caption text-sage">{s.name}</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <DollarSign className="w-5 h-5 text-gold" />
                    <span className="font-display text-2xl text-ink">
                      {fmtMoney(data.totalsByYear[s.year]?.estimated)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-ink/60">total estimated outflow</div>
                </div>
              ))}
            </div>
          </>
        )}

        {edit.open && edit.seasonId && edit.category && (
          <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" onClick={() => setEdit(EMPTY_EDIT)}>
            <div className="luxury-card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg text-ink">
                  {CAT_LABELS[edit.category]} · {edit.year}
                </h2>
                <button onClick={() => setEdit(EMPTY_EDIT)} className="text-ink/60 hover:text-ink">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="form-label">Estimated $</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={edit.estimated}
                    onChange={(e) => setEdit({ ...edit, estimated: e.target.value })}
                    className="form-input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="form-label">Actual $ <span className="text-xs text-ink/40">(optional)</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={edit.actual}
                    onChange={(e) => setEdit({ ...edit, actual: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <input
                    type="text"
                    value={edit.description}
                    onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                    className="form-input"
                    placeholder="e.g. CES Power generator"
                  />
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <textarea
                    value={edit.notes}
                    onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                    className="form-input min-h-[80px]"
                    placeholder="Vendor, context, contingencies..."
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button onClick={() => setEdit(EMPTY_EDIT)} className="cta-secondary">Cancel</button>
                <button onClick={handleSave} disabled={upsert.isPending} className="cta-primary inline-flex items-center gap-1.5">
                  {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
              {upsert.error && (
                <div className="mt-3 text-sm text-red-600">Save failed: {upsert.error.message}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
