'use client';

/**
 * Date input bound to a Burning Man season's calendar.
 * - Bounds the picker to (buildStartDate … strikeEndDate) so admins can't pick
 *   a January date by accident.
 * - Surfaces a row of click-to-fill milestone chips (Build Week, Gate,
 *   Burn Night, Temple Burn, Strike Ends) so admins don't have to
 *   compute "what's the Saturday" in their head.
 * - Falls back gracefully when a season has incomplete dates — milestones
 *   that can't be derived just don't render.
 *
 * Burn weekend convention (consistent every year since 1986): if startDate
 * is the Sunday gate opens, Burn Night = +6 days (Saturday) and Temple Burn
 * = +7 days (Sunday).
 */

import { useMemo } from 'react';

export interface SeasonDates {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  buildStartDate?: string | Date | null;
  strikeEndDate?: string | Date | null;
}

interface Props {
  value: string; // ISO date (YYYY-MM-DD)
  onChange: (next: string) => void;
  season?: SeasonDates | null;
  label?: string;
  /** Tints the chips' default suggestion ("Gate Opens" highlighted for arrivals,
   *  "Strike Ends" highlighted for departures). Cosmetic only. */
  mode?: 'arrival' | 'departure';
  id?: string;
  className?: string;
}

function toISODate(d: Date): string {
  // Use local timezone components to avoid the off-by-one drift you get
  // from .toISOString() when the date is near midnight UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Parse as local date to avoid UTC shift
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

const dowShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function fmtChip(d: Date): string {
  return `${dowShort[d.getDay()]} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function SeasonDateInput({
  value,
  onChange,
  season,
  label,
  mode = 'arrival',
  id,
  className,
}: Props) {
  const milestones = useMemo(() => {
    const start = parseDate(season?.startDate);
    const end = parseDate(season?.endDate);
    const buildStart = parseDate(season?.buildStartDate);
    const strikeEnd = parseDate(season?.strikeEndDate);

    // Burn-weekend convention: startDate = Sun gate opens
    const burnNight = start ? addDays(start, 6) : null;
    const templeBurn = start ? addDays(start, 7) : null;

    const list: { key: string; label: string; sub?: string; date: Date; emphasis?: boolean }[] = [];

    if (buildStart) {
      list.push({
        key: 'build',
        label: 'Build Week',
        sub: 'crew arrives',
        date: buildStart,
      });
    }
    if (start) {
      list.push({
        key: 'gate',
        label: 'Gate Opens',
        sub: 'event start',
        date: start,
        emphasis: mode === 'arrival',
      });
    }
    if (burnNight) {
      list.push({ key: 'burn', label: 'Burn Night', sub: 'Sat', date: burnNight });
    }
    if (templeBurn) {
      list.push({ key: 'temple', label: 'Temple Burn', sub: 'Sun', date: templeBurn });
    }
    if (end && (!templeBurn || toISODate(end) !== toISODate(templeBurn))) {
      list.push({ key: 'end', label: 'Event End', date: end });
    }
    if (strikeEnd) {
      list.push({
        key: 'strike',
        label: 'Strike Ends',
        sub: 'crew out',
        date: strikeEnd,
        emphasis: mode === 'departure',
      });
    }

    return list;
  }, [season, mode]);

  const start = parseDate(season?.startDate);
  const strikeEnd = parseDate(season?.strikeEndDate);
  const buildStart = parseDate(season?.buildStartDate);
  const end = parseDate(season?.endDate);

  // Allow a couple of days of slack on either side
  const min = buildStart
    ? toISODate(addDays(buildStart, -3))
    : start
    ? toISODate(addDays(start, -10))
    : undefined;
  const max = strikeEnd
    ? toISODate(addDays(strikeEnd, 3))
    : end
    ? toISODate(addDays(end, 3))
    : undefined;

  return (
    <div className={className}>
      {label && (
        <label className="form-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="form-input"
      />

      {milestones.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {milestones.map((m) => {
            const iso = toISODate(m.date);
            const isSelected = value === iso;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onChange(iso)}
                className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  isSelected
                    ? 'border-sage bg-sage/10 text-sage'
                    : m.emphasis
                    ? 'border-gold/40 bg-gold/5 text-ink hover:bg-gold/10'
                    : 'border-tan/40 bg-white text-ink-soft hover:bg-cream'
                }`}
                title={`${m.label} — ${m.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
              >
                <span className="font-medium">{m.label}</span>
                <span className="text-ink-soft/70 group-hover:text-ink-soft">{fmtChip(m.date)}</span>
              </button>
            );
          })}
        </div>
      )}

      {!season?.startDate && (
        <p className="mt-1.5 text-[11px] text-ink-soft/60">
          Set the season&apos;s Burning Man dates in <a href="/admin/season" className="underline">/admin/season</a> to unlock milestone shortcuts.
        </p>
      )}
    </div>
  );
}
