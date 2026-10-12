'use client';

/**
 * /admin/charges — Charge Catalog manager.
 *
 * Allows LEAD / MANAGER roles to CRUD ChargeItems for the selected season.
 * A ChargeItem is a reusable billing line (dues, art-car fee, etc.) that can be
 * assigned to individual members from the roster.
 *
 * Data flow: raw fetch → /api/trpc/* with superjson envelopes.
 * Season resolution: useAdminSeason() (shared context, same as roster page).
 */

import { Fragment, useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Check,
  X,
  Pencil,
  Tag,
} from 'lucide-react';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChargeItem {
  id: string;
  seasonId: string;
  name: string;
  description: string | null;
  amountCents: number;
  selfServe: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** tRPC error body on HTTP 200: { error: { json: { message: string } } }. */
function extractTrpcError(body: unknown): string | null {
  try {
    const b = body as { error?: { json?: { message?: string }; message?: string } };
    return b?.error?.json?.message ?? b?.error?.message ?? null;
  } catch {
    return null;
  }
}

async function trpcQueryCharges<T>(
  path: string,
  input?: Record<string, unknown>,
): Promise<T> {
  const qs = input
    ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : '';
  const res = await fetch(`/api/trpc/${path}${qs}`, { credentials: 'include' });
  const json = await res.json();
  // Check for tRPC application-level error even when HTTP 200
  const trpcErr = extractTrpcError(json);
  if (trpcErr) throw new Error(trpcErr);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  const r = json as { result?: { data?: { json?: T } } };
  return r.result?.data?.json as T;
}

async function trpcMutationCharges<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: body }),
  });
  const json = await res.json();
  const trpcErr = extractTrpcError(json);
  if (trpcErr) throw new Error(trpcErr);
  if (!res.ok) throw new Error(`Mutation failed: ${path}`);
  const r = json as { result?: { data?: { json?: T } } };
  return r.result?.data?.json as T;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Badge({
  on,
  onLabel,
  offLabel,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        on
          ? 'bg-sage/15 text-sage'
          : 'bg-tan/20 text-ink-soft'
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

// ---------------------------------------------------------------------------
// New-item form
// ---------------------------------------------------------------------------

interface NewItemFormProps {
  seasonId: string;
  onCreated: () => void;
  onFlash: (msg: string) => void;
}

function NewItemForm({ seasonId, onCreated, onFlash }: NewItemFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [selfServe, setSelfServe] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setAmountDollars('');
    setSelfServe(false);
    setSortOrder('0');
    setErr(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const dollars = parseFloat(amountDollars);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setErr('Amount must be a positive number (e.g. 450 or 49.99).');
      return;
    }
    const amountCents = Math.round(dollars * 100);
    setSaving(true);
    try {
      await trpcMutationCharges<ChargeItem>('charges.itemCreate', {
        seasonId,
        name: name.trim(),
        description: description.trim() || undefined,
        amountCents,
        selfServe,
        sortOrder: parseInt(sortOrder, 10) || 0,
      });
      onFlash(`"${name.trim()}" created.`);
      reset();
      setOpen(false);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create item.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
      >
        <Plus className="h-4 w-4" />
        New item
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="luxury-card p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">New charge item</h3>
        <button
          type="button"
          onClick={() => { reset(); setOpen(false); }}
          className="p-1 text-ink-soft hover:text-ink transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Name */}
          <div className="sm:col-span-2">
            <label className="form-label text-xs">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              placeholder="e.g. Membership dues"
              className="form-input mt-1"
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="form-label text-xs">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Short note shown to members (leave blank to omit)"
              className="form-input mt-1 resize-none"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="form-label text-xs">Amount (USD) *</label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-soft text-sm">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                required
                placeholder="0.00"
                className="form-input pl-6"
              />
            </div>
          </div>

          {/* Sort order */}
          <div>
            <label className="form-label text-xs">Sort order</label>
            <input
              type="number"
              min="0"
              max="10000"
              step="1"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="form-input mt-1"
            />
          </div>

          {/* Self-serve */}
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="new-self-serve"
              type="checkbox"
              checked={selfServe}
              onChange={(e) => setSelfServe(e.target.checked)}
              className="h-4 w-4 rounded border-tan/40 text-sage focus:ring-sage"
            />
            <label htmlFor="new-self-serve" className="text-sm text-ink-soft cursor-pointer">
              Self-serve — members can pay this themselves from the portal
            </label>
          </div>
        </div>

        {err && (
          <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {err}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => { reset(); setOpen(false); }}
            className="px-3 py-1.5 rounded-lg text-sm text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim() || !amountDollars}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage/90 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create item
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Inline edit row
// ---------------------------------------------------------------------------

interface EditRowProps {
  item: ChargeItem;
  onSaved: () => void;
  onCancel: () => void;
  onFlash: (msg: string) => void;
}

function EditRow({ item, onSaved, onCancel, onFlash }: EditRowProps) {
  const [name, setName] = useState(item.name);
  const [amountDollars, setAmountDollars] = useState(
    (item.amountCents / 100).toFixed(2),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    setErr(null);
    const dollars = parseFloat(amountDollars);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setErr('Amount must be positive.');
      return;
    }
    const amountCents = Math.round(dollars * 100);
    setSaving(true);
    try {
      await trpcMutationCharges<ChargeItem>('charges.itemUpdate', {
        id: item.id,
        name: name.trim(),
        amountCents,
      });
      onFlash('Item updated.');
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <td colSpan={7} className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className="form-input text-sm py-1 min-w-[180px] flex-1"
          placeholder="Name"
        />
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-3 text-ink-soft text-sm">$</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            className="form-input text-sm py-1 pl-6 w-28"
            placeholder="0.00"
          />
        </div>
        {err && (
          <span className="text-xs text-red-600">{err}</span>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1 rounded-md border border-sage/40 bg-sage/10 px-3 py-1 text-xs font-medium text-sage hover:bg-sage/20 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-tan/40 px-3 py-1 text-xs text-ink-soft hover:bg-cream transition-colors"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>
    </td>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ChargesPage() {
  const { selectedSeasonId, selectedSeason } = useAdminSeason();

  const [items, setItems] = useState<ChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Per-row mutation tracking
  const [busyId, setBusyId] = useState<string | null>(null);
  // Row currently open for inline edit
  const [editId, setEditId] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }, []);

  const load = useCallback(async () => {
    if (!selectedSeasonId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await trpcQueryCharges<ChargeItem[]>('charges.itemsList', {
        seasonId: selectedSeasonId,
        includeInactive: true,
      });
      setItems(result ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load charge items.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  // Toggle a boolean field (active or selfServe)
  const toggleField = useCallback(
    async (item: ChargeItem, field: 'active' | 'selfServe') => {
      setBusyId(item.id);
      const next = !item[field];
      // Optimistic update
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, [field]: next } : it)),
      );
      try {
        await trpcMutationCharges<ChargeItem>('charges.itemUpdate', {
          id: item.id,
          [field]: next,
        });
        flash(
          field === 'active'
            ? next
              ? 'Item activated.'
              : 'Item deactivated.'
            : next
            ? 'Self-serve enabled.'
            : 'Self-serve disabled.',
        );
      } catch (e) {
        // Roll back
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, [field]: !next } : it)),
        );
        flash(e instanceof Error ? e.message : 'Update failed.');
      } finally {
        setBusyId(null);
      }
    },
    [flash],
  );

  const seasonLabel = selectedSeason ? selectedSeason.name : 'the selected season';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display-thin text-3xl text-ink">Charge Catalog</h1>
          <p className="text-body-relaxed text-sm text-ink-soft mt-1">
            {loading ? (
              'Loading…'
            ) : (
              <>
                {items.length} item{items.length !== 1 ? 's' : ''} in {seasonLabel}
                {items.filter((i) => !i.active).length > 0 && (
                  <span className="text-ink-soft/70">
                    {' '}
                    &middot; {items.filter((i) => !i.active).length} inactive
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="inline-flex items-center gap-1.5 rounded-lg border border-tan/40 px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {selectedSeasonId && (
            <NewItemForm
              seasonId={selectedSeasonId}
              onCreated={load}
              onFlash={flash}
            />
          )}
        </div>
      </div>

      {/* Flash notice */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-20 right-6 z-50 rounded-lg border border-sage/30 bg-white px-4 py-2.5 text-sm text-ink shadow-lg"
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No season selected */}
      {!selectedSeasonId && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            No season selected. Use the season picker above to choose a season.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
          <button
            onClick={load}
            className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && selectedSeasonId && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Loading charge items…</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && selectedSeasonId && items.length === 0 && (
        <div className="luxury-card flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Tag className="h-10 w-10 text-ink-soft/30" />
          <div>
            <p className="text-sm font-medium text-ink">No charge items yet</p>
            <p className="mt-1 text-xs text-ink-soft">
              Create your first item above — e.g. membership dues, art-car fees.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && items.length > 0 && (
        <div className="luxury-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sage/10 bg-cream/50">
                  <th className="py-3 px-4 text-left text-xs font-medium text-ink-soft uppercase tracking-wider">
                    Name
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-ink-soft uppercase tracking-wider hidden md:table-cell">
                    Description
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-ink-soft uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-ink-soft uppercase tracking-wider hidden sm:table-cell">
                    Self-serve
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-ink-soft uppercase tracking-wider">
                    Active
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-ink-soft uppercase tracking-wider hidden lg:table-cell">
                    Sort
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-ink-soft uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <Fragment key={item.id}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.2 }}
                      className={`border-b border-sage/5 transition-colors align-middle ${
                        item.active ? 'hover:bg-sage/[0.03]' : 'bg-cream/30 opacity-70 hover:opacity-90'
                      }`}
                    >
                      {editId === item.id ? (
                        <EditRow
                          item={item}
                          onSaved={() => { setEditId(null); load(); }}
                          onCancel={() => setEditId(null)}
                          onFlash={flash}
                        />
                      ) : (
                        <>
                          {/* Name */}
                          <td className="py-3 px-4">
                            <span className="font-medium text-ink">{item.name}</span>
                          </td>

                          {/* Description */}
                          <td className="py-3 px-4 hidden md:table-cell">
                            <span className="text-xs text-ink-soft line-clamp-2 max-w-[240px]">
                              {item.description ?? <span className="opacity-40">—</span>}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-4 tabular-nums font-medium text-ink">
                            {fmtUSD(item.amountCents)}
                          </td>

                          {/* Self-serve */}
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <button
                              onClick={() => toggleField(item, 'selfServe')}
                              disabled={busyId === item.id}
                              title={item.selfServe ? 'Click to disable self-serve' : 'Click to enable self-serve'}
                              className="disabled:opacity-50 transition-opacity"
                            >
                              <Badge
                                on={item.selfServe}
                                onLabel="Self-serve"
                                offLabel="Admin only"
                              />
                            </button>
                          </td>

                          {/* Active */}
                          <td className="py-3 px-4">
                            <button
                              onClick={() => toggleField(item, 'active')}
                              disabled={busyId === item.id}
                              title={item.active ? 'Click to deactivate' : 'Click to activate'}
                              className="disabled:opacity-50 transition-opacity"
                            >
                              {busyId === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-soft" />
                              ) : (
                                <Badge
                                  on={item.active}
                                  onLabel="Active"
                                  offLabel="Inactive"
                                />
                              )}
                            </button>
                          </td>

                          {/* Sort order */}
                          <td className="py-3 px-4 hidden lg:table-cell">
                            <span className="text-xs tabular-nums text-ink-soft">{item.sortOrder}</span>
                          </td>

                          {/* Edit button */}
                          <td className="py-3 px-4">
                            <button
                              onClick={() => setEditId(editId === item.id ? null : item.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-tan/40 px-2.5 py-1 text-xs text-ink-soft hover:bg-cream transition-colors"
                              title="Edit name and amount"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </motion.tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-sage/10 px-4 py-2.5 text-xs text-ink-soft">
            {items.length} item{items.length !== 1 ? 's' : ''} &middot; Click{' '}
            <strong>Active</strong> or <strong>Self-serve</strong> badges to toggle.
            Click <strong>Edit</strong> to rename or change the amount.
          </div>
        </div>
      )}
    </div>
  );
}
