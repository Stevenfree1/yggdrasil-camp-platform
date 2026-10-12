'use client';

import { useEffect, useMemo, useState } from 'react';
import { Home, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '../../lib/trpc';

/**
 * Member-facing housing self-service for the active season.
 *
 * The portal's Season Readiness checklist has always had a "Housing" row, but
 * nothing behind it — so the roster's housing data stayed blank and the camp
 * map had nothing to place. This is that missing form. Values pre-fill from
 * whatever we already know (including what the member wrote on their
 * application), so the common case is confirming rather than typing.
 */

const HOUSING_OPTIONS = [
  { value: 'TENT', label: 'Tent', hint: 'Bring your own tent' },
  { value: 'SHIFTPOD', label: 'ShiftPod', hint: '12 ft hexagonal pod' },
  { value: 'RV', label: 'RV', hint: 'Motorhome or campervan' },
  { value: 'TRAILER', label: 'Trailer', hint: 'Towed trailer' },
  { value: 'DORM', label: 'Camp dorm', hint: 'Shared camp-provided sleeping' },
  { value: 'SHARED', label: 'Sharing', hint: "Staying in someone else's setup" },
  { value: 'HEXAYURT', label: 'Hexayurt', hint: 'Built on playa' },
  { value: 'OTHER', label: 'Other', hint: 'Tell us in the size field' },
] as const;

const POWER_OPTIONS = [
  { value: 'NONE', label: 'None', hint: 'No grid hookup' },
  { value: 'AMP_15', label: '15A', hint: 'Fan, lights, charging' },
  { value: 'AMP_30', label: '30A', hint: 'Small RV / AC unit' },
  { value: 'AMP_50', label: '50A', hint: 'Full RV service' },
] as const;

type HousingType = (typeof HOUSING_OPTIONS)[number]['value'];
type GridPower = (typeof POWER_OPTIONS)[number]['value'];

export function MyHousingCard() {
  const seasonStatus = trpc.seasonMembers.getMySeasonStatus.useQuery();
  const initial = useMemo(
    () => ({
      housingType: seasonStatus.data?.housingType ?? null,
      housingSize: seasonStatus.data?.housingSize ?? null,
      gridPower: seasonStatus.data?.gridPower ?? null,
      sharedWithId: seasonStatus.data?.sharedWithId ?? null,
    }),
    [seasonStatus.data],
  );

  const [housingType, setHousingType] = useState<HousingType | null>(null);
  const [housingSize, setHousingSize] = useState('');
  const [gridPower, setGridPower] = useState<GridPower>('NONE');
  const [sharedWithId, setSharedWithId] = useState<string | null>(null);
  const [mateQuery, setMateQuery] = useState('');
  const [mateLabel, setMateLabel] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Seed the form once the season row arrives, then leave edits alone.
  useEffect(() => {
    if (hydrated || !seasonStatus.data) return;
    setHousingType((initial.housingType as HousingType) ?? null);
    setHousingSize(initial.housingSize ?? '');
    setGridPower((initial.gridPower as GridPower) ?? 'NONE');
    setSharedWithId(initial.sharedWithId ?? null);
    setHydrated(true);
  }, [seasonStatus.data, initial, hydrated]);

  const utils = trpc.useUtils();
  const save = trpc.seasonMembers.updateMyHousing.useMutation({
    onSuccess: () => {
      toast.success('Housing saved. Thank you — this is what places you on the camp map.');
      utils.seasonMembers.getMySeasonStatus.invalidate();
    },
    onError: (err) => toast.error(err.message || 'Could not save your housing.'),
  });

  const mates = trpc.seasonMembers.searchMySeasonMates.useQuery(
    { search: mateQuery },
    { enabled: mateQuery.trim().length >= 2 },
  );

  // Sharing is the only mode where naming a camp mate is meaningful.
  const showMate = housingType === 'SHARED';
  useEffect(() => {
    if (!showMate && sharedWithId) setSharedWithId(null);
  }, [showMate, sharedWithId]);

  const dirty = useMemo(
    () =>
      housingType !== (initial.housingType ?? null) ||
      housingSize !== (initial.housingSize ?? '') ||
      gridPower !== ((initial.gridPower as GridPower) ?? 'NONE') ||
      sharedWithId !== (initial.sharedWithId ?? null),
    [housingType, housingSize, gridPower, sharedWithId, initial],
  );

  // Not on this season's roster (or no active season) — nothing to ask about.
  if (!seasonStatus.isLoading && !seasonStatus.data) return null;

  return (
    <div className="luxury-card p-6" id="housing">
      <div className="flex items-center gap-3 mb-2">
        <Home className="h-5 w-5 text-gold" />
        <h2 className="text-display-thin text-xl text-ink">Housing</h2>
      </div>
      <p className="text-sm text-ink-soft mb-6 max-w-prose">
        Where you&apos;ll sleep this year. This is what puts you on the camp map and sizes our
        shade, power, and layout — please keep it current.
      </p>

      <div className="space-y-6">
        <div>
          <span className="form-label">What are you sleeping in?</span>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {HOUSING_OPTIONS.map((opt) => {
              const active = housingType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setHousingType(active ? null : opt.value)}
                  aria-pressed={active}
                  className={`rounded border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-gold bg-gold/15 text-ink'
                      : 'border-warm-border text-ink/70 hover:bg-cream/60'
                  }`}
                >
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-[11px] text-ink-soft leading-tight mt-0.5">{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="housingSize" className="form-label">
              Size or details <span className="text-ink-soft font-normal">(optional)</span>
            </label>
            <input
              id="housingSize"
              type="text"
              value={housingSize}
              onChange={(e) => setHousingSize(e.target.value)}
              className="form-input"
              placeholder="e.g. 10×14 tent, 24 ft RV"
            />
            <p className="text-xs text-ink-soft mt-1">
              Footprint helps us leave the right gap around you.
            </p>
          </div>

          <div>
            <span className="form-label">Grid power</span>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {POWER_OPTIONS.map((opt) => {
                const active = gridPower === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGridPower(opt.value)}
                    aria-pressed={active}
                    title={opt.hint}
                    className={`rounded border px-2 py-2 text-center text-sm transition-colors ${
                      active
                        ? 'border-gold bg-gold/15 text-ink font-medium'
                        : 'border-warm-border text-ink/70 hover:bg-cream/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-ink-soft mt-1">
              Grid power is billed separately and ordered ahead — only pick a tier you need.
            </p>
          </div>
        </div>

        {showMate && (
          <div>
            <label htmlFor="mate" className="form-label">Sharing with</label>
            {sharedWithId ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-sage/10 px-3 py-1 text-sm text-sage">
                  <Check className="h-3.5 w-3.5" />
                  {mateLabel ?? 'Selected camp mate'}
                </span>
                <button
                  type="button"
                  onClick={() => { setSharedWithId(null); setMateLabel(null); }}
                  className="text-ink-soft hover:text-ink"
                  aria-label="Clear camp mate"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <input
                  id="mate"
                  type="text"
                  value={mateQuery}
                  onChange={(e) => setMateQuery(e.target.value)}
                  className="form-input"
                  placeholder="Start typing a camp mate's name"
                  autoComplete="off"
                />
                {mateQuery.trim().length >= 2 && (
                  <div className="mt-1 rounded border border-warm-border divide-y divide-warm-border/60 overflow-hidden">
                    {mates.isLoading && (
                      <div className="px-3 py-2 text-sm text-ink-soft">Searching…</div>
                    )}
                    {mates.data?.length === 0 && !mates.isLoading && (
                      <div className="px-3 py-2 text-sm text-ink-soft">No match on this season&apos;s roster.</div>
                    )}
                    {mates.data?.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSharedWithId(m.id);
                          setMateLabel(m.playaName ?? m.name);
                          setMateQuery('');
                        }}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-cream/60"
                      >
                        {m.playaName ?? m.name}
                        {m.playaName && <span className="text-ink-soft"> · {m.name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() =>
              save.mutate({
                housingType,
                housingSize: housingSize.trim() || null,
                gridPower,
                sharedWithId,
              })
            }
            className="cta-primary disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save housing
          </button>
          {!dirty && !save.isPending && (
            <span className="text-xs text-ink-soft">No changes to save.</span>
          )}
        </div>
      </div>
    </div>
  );
}
