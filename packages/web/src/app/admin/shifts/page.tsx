'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ClipboardList,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';
import { formatDayShort, toDateInputValue } from '../../../lib/dates';
import {
  fetchShiftGrid,
  fetchShiftUnderstaffed,
  fetchAssignableMembers,
  setShiftSignupOpen,
  upsertShiftBlock,
  deleteShiftBlock,
  upsertShiftSlot,
  deleteShiftSlot,
  generateShiftInstances,
  assignShiftInstance,
  clearShiftInstance,
  getApiErrorMessage,
  type ShiftGridResult,
  type ShiftUnderstaffed,
  type ShiftInstanceDTO,
} from '../../../lib/adminApi';

type Cell = { instance: ShiftInstanceDTO; slotLabel: string; blockName: string };
type BlockForm = { id?: string; name: string; startTime: string; endTime: string };

/**
 * The shift grid: slots down, dates across, one cell per instance. This mirrors
 * how the camp has always read the schedule on paper, and it means coverage is
 * the grid itself rather than a separate report — an empty cell is the gap.
 */
export default function AdminShiftsPage() {
  const { selectedSeasonId } = useAdminSeason();
  const [grid, setGrid] = useState<ShiftGridResult | null>(null);
  const [understaffed, setUnderstaffed] = useState<ShiftUnderstaffed | null>(null);
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cell, setCell] = useState<Cell | null>(null);
  const [blockForm, setBlockForm] = useState<BlockForm | null>(null);
  const [showChase, setShowChase] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, u] = await Promise.all([
        fetchShiftGrid(selectedSeasonId || undefined),
        fetchShiftUnderstaffed(selectedSeasonId || undefined).catch(() => null),
      ]);
      setGrid(g);
      setUnderstaffed(u);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [selectedSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  // The roster is only needed once a cell is open for assignment.
  useEffect(() => {
    if (!cell || roster.length) return;
    fetchAssignableMembers({ seasonId: selectedSeasonId || undefined, limit: 500 })
      .then((r) =>
        setRoster(
          (r.seasonMembers ?? []).map((sm) => ({
            id: sm.id,
            name: sm.member?.name ?? 'Unknown',
          })),
        ),
      )
      .catch(() => setRoster([]));
  }, [cell, roster.length, selectedSeasonId]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      setError(getApiErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    let total = 0;
    let filled = 0;
    for (const b of grid?.blocks ?? []) {
      for (const s of b.slots) {
        for (const i of s.instances) {
          total += 1;
          if (i.seasonMemberId) filled += 1;
        }
      }
    }
    return { total, filled };
  }, [grid]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const open = grid?.season.shiftSignupOpen ?? false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 font-display text-2xl text-ink">
            <ClipboardList className="h-6 w-6 text-gold" />
            Shifts
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {stats.total === 0
              ? 'Nothing built yet — add a block, give it slots, then generate days.'
              : `${stats.filled} of ${stats.total} cells filled`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="cta-secondary px-3 py-1.5 text-sm" disabled={busy}>
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={() => run(() => setShiftSignupOpen(!open, selectedSeasonId || undefined))}
            disabled={busy}
            aria-pressed={open}
            className={`inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium ${
              open
                ? 'border border-gold/60 bg-gold/10 text-ink'
                : 'border border-warm-border text-ink/70'
            }`}
            title={
              open
                ? 'Members can sign themselves up right now'
                : 'Members cannot sign up yet — build the grid first'
            }
          >
            {open ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {open ? 'Signup is OPEN' : 'Signup is CLOSED'}
          </button>
        </div>
      </div>

      {!open && stats.total > 0 && (
        <div className="luxury-card border-l-4 border-l-gold p-3 text-sm text-ink/70">
          Members cannot see or claim these yet. Open signup when the grid is ready — you can keep
          editing afterwards.
        </div>
      )}

      {error && (
        <div className="luxury-card border-red-300 p-3 text-sm text-red-700">
          <AlertCircle className="mr-1 inline h-4 w-4" />
          {error}
        </div>
      )}

      <button
        onClick={() => setBlockForm({ name: '', startTime: '16:00', endTime: '18:00' })}
        className="cta-primary px-3 py-1.5 text-sm"
      >
        <Plus className="mr-1 inline h-3.5 w-3.5" />
        Add block
      </button>

      {grid && grid.blocks.length > 0 && (
        <div className="luxury-card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-cream px-3 py-2 text-left text-xs uppercase tracking-wide text-ink/50">
                  Slot
                </th>
                {grid.dates.map((d) => (
                  <th
                    key={d}
                    className="px-2 py-2 text-center text-xs uppercase tracking-wide text-ink/50"
                  >
                    {formatDayShort(`${d}T12:00:00.000Z`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.blocks.map((block) => (
                <BlockRows
                  key={block.id}
                  block={block}
                  dates={grid.dates}
                  busy={busy}
                  onEditBlock={() =>
                    setBlockForm({
                      id: block.id,
                      name: block.name,
                      startTime: block.startTime,
                      endTime: block.endTime,
                    })
                  }
                  onAddSlot={() => {
                    const label = window.prompt(`New slot in "${block.name}"`);
                    if (label?.trim()) {
                      run(() =>
                        upsertShiftSlot({
                          blockId: block.id,
                          label: label.trim(),
                          sortOrder: block.slots.length,
                        }),
                      );
                    }
                  }}
                  onAddDays={() => {
                    const raw = window.prompt(
                      'Generate days (comma-separated YYYY-MM-DD)',
                      grid.dates.join(',') || toDateInputValue(new Date()),
                    );
                    const dates = (raw ?? '')
                      .split(',')
                      .map((d) => d.trim())
                      .filter(Boolean);
                    if (dates.length) run(() => generateShiftInstances(block.id, dates));
                  }}
                  onDeleteBlock={() => {
                    if (window.confirm(`Delete block "${block.name}" and all its cells?`)) {
                      run(() => deleteShiftBlock(block.id, true));
                    }
                  }}
                  onDeleteSlot={(slotId, label) => {
                    if (window.confirm(`Remove slot "${label}"?`)) {
                      run(() => deleteShiftSlot(slotId, true));
                    }
                  }}
                  onOpenCell={(instance, slotLabel) =>
                    setCell({ instance, slotLabel, blockName: block.name })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {understaffed && understaffed.members.length > 0 && stats.total > 0 && (
        <div className="luxury-card p-4">
          <button
            onClick={() => setShowChase((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="font-display text-lg text-ink">
              Below the minimum ({understaffed.min} shifts)
            </span>
            <span className="text-sm text-ink/60">
              {understaffed.members.length} members {showChase ? '▲' : '▼'}
            </span>
          </button>
          {showChase && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {understaffed.members.map((m) => (
                <span
                  key={m.seasonMemberId}
                  className="rounded border border-warm-border px-2 py-0.5 text-xs tabular-nums text-ink"
                >
                  {m.name} · {m.count}/{understaffed.min}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {cell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setCell(null)}
        >
          <div
            className="luxury-card max-h-[80vh] w-full max-w-md overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg text-ink">{cell.slotLabel}</h3>
                <p className="text-sm text-ink/60">
                  {cell.blockName} · {formatDayShort(cell.instance.date)}
                </p>
              </div>
              <button onClick={() => setCell(null)} aria-label="Close">
                <X className="h-5 w-5 text-ink/60" />
              </button>
            </div>

            {cell.instance.seasonMember && (
              <div className="mb-3 flex items-center justify-between rounded border border-warm-border p-2">
                <span className="text-sm text-ink">{cell.instance.seasonMember.member.name}</span>
                <button
                  onClick={async () => {
                    if (await run(() => clearShiftInstance(cell.instance.id))) setCell(null);
                  }}
                  className="text-sm text-red-700 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}

            <label className="form-label">Assign someone</label>
            <select
              className="form-input"
              defaultValue=""
              disabled={busy || roster.length === 0}
              onChange={async (e) => {
                if (!e.target.value) return;
                if (await run(() => assignShiftInstance(cell.instance.id, e.target.value))) {
                  setCell(null);
                }
              }}
            >
              <option value="">{roster.length ? 'Select a member…' : 'Loading roster…'}</option>
              {roster.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {blockForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setBlockForm(null)}
        >
          <form
            className="luxury-card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(() =>
                upsertShiftBlock({
                  id: blockForm.id,
                  seasonId: selectedSeasonId || undefined,
                  name: blockForm.name,
                  startTime: blockForm.startTime,
                  endTime: blockForm.endTime,
                }),
              );
              if (ok) setBlockForm(null);
            }}
          >
            <h3 className="mb-3 font-display text-lg text-ink">
              {blockForm.id ? 'Edit block' : 'New block'}
            </h3>
            <label className="form-label">Name</label>
            <input
              className="form-input"
              required
              value={blockForm.name}
              placeholder="Cleaning/MOOP"
              onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Start</label>
                <input
                  className="form-input"
                  type="time"
                  required
                  value={blockForm.startTime}
                  onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">End</label>
                <input
                  className="form-input"
                  type="time"
                  required
                  value={blockForm.endTime}
                  onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="cta-secondary px-3 py-1.5 text-sm"
                onClick={() => setBlockForm(null)}
              >
                Cancel
              </button>
              <button className="cta-primary px-3 py-1.5 text-sm" disabled={busy}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function BlockRows({
  block,
  dates,
  busy,
  onEditBlock,
  onAddSlot,
  onAddDays,
  onDeleteBlock,
  onDeleteSlot,
  onOpenCell,
}: {
  block: ShiftGridResult['blocks'][number];
  dates: string[];
  busy: boolean;
  onEditBlock: () => void;
  onAddSlot: () => void;
  onAddDays: () => void;
  onDeleteBlock: () => void;
  onDeleteSlot: (slotId: string, label: string) => void;
  onOpenCell: (instance: ShiftInstanceDTO, slotLabel: string) => void;
}) {
  const link = 'text-xs text-ink/50 underline hover:text-ink disabled:opacity-40';
  return (
    <>
      <tr className="bg-cream/70">
        <td colSpan={dates.length + 1} className="px-3 py-2">
          <span
            className="inline-flex flex-wrap items-center gap-2 font-display text-base text-ink"
            title={block.notes ?? undefined}
          >
            {block.name}
            <span className="text-xs font-normal tabular-nums text-ink/50">
              {block.startTime}–{block.endTime}
            </span>
            <button className={link} onClick={onEditBlock} disabled={busy}>
              edit
            </button>
            <button className={link} onClick={onAddSlot} disabled={busy}>
              + slot
            </button>
            <button className={link} onClick={onAddDays} disabled={busy}>
              + days
            </button>
            <button
              className="text-xs text-red-700 underline disabled:opacity-40"
              onClick={onDeleteBlock}
              disabled={busy}
            >
              delete
            </button>
          </span>
        </td>
      </tr>
      {block.slots.map((slot) => (
        <tr key={slot.id} className="border-t border-warm-border">
          <td
            className="sticky left-0 z-10 bg-white px-3 py-1.5 text-ink"
            title={slot.requirement ?? undefined}
          >
            <span className="flex items-center gap-1.5">
              {slot.label}
              <button
                onClick={() => onDeleteSlot(slot.id, slot.label)}
                className="text-ink/30 hover:text-red-700"
                aria-label={`Remove ${slot.label}`}
                disabled={busy}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
            {slot.requirement && (
              <span className="block max-w-[220px] truncate text-[11px] text-ink/50">
                {slot.requirement}
              </span>
            )}
          </td>
          {dates.map((d) => {
            const inst = slot.instances.find((i) => i.date.slice(0, 10) === d);
            // No instance means the block does not run that day — distinct from
            // an open cell, and shown differently.
            if (!inst) {
              return (
                <td key={d} className="bg-cream/40 px-2 py-1.5 text-center text-ink/25">
                  –
                </td>
              );
            }
            const who = inst.seasonMember?.member.name;
            return (
              <td key={d} className="px-1 py-1 text-center">
                <button
                  onClick={() => onOpenCell(inst, slot.label)}
                  className={`w-full truncate rounded px-1.5 py-1 text-xs ${
                    who
                      ? 'bg-sage/15 text-ink hover:bg-sage/25'
                      : 'border border-dashed border-warm-border text-ink/35 hover:bg-cream/60'
                  }`}
                  title={who ?? 'Open — click to assign'}
                >
                  {who ?? 'open'}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
