'use client';

import { useState } from 'react';
import { AlertCircle, ChevronDown, CloudSun } from 'lucide-react';
import { trpc } from '../../lib/trpc';

/**
 * Burning Man's official BRC forecast, from the brcweather.com sheet via
 * dashboard.weather. Self-hiding: the endpoint returns null whenever the
 * forecast is stale, unavailable, or unparseable, and this renders nothing —
 * so the card exists during the event window and vanishes off-season with no
 * toggle anywhere.
 *
 * Collapsed by default to a single summary line; the full forecast (advisories,
 * every period, disclaimer) lives behind the tap.
 */

/** Sheet times are Pacific; members read this from anywhere. Pin the zone. */
const PACIFIC: Intl.DateTimeFormatOptions = { timeZone: 'America/Los_Angeles' };

function shortStamp(d: Date): string {
  return d.toLocaleString('en-US', {
    ...PACIFIC,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-full border border-warm-border bg-cream/60 px-2 py-0.5 text-[11px] text-ink/85">
      <span className="uppercase tracking-wide text-ink/70">{label}</span>
      <span className="font-medium tabular-nums text-ink/80">{value}</span>
    </span>
  );
}

function PeriodRow({
  period,
}: {
  period: { label: string; text: string; highF?: number; lowF?: number; gustMph?: number; precipPct?: number };
}) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h3 className="text-sm font-medium text-ink">{period.label}</h3>
        <div className="flex flex-wrap gap-1.5">
          {period.highF !== undefined && <Chip label="High" value={`${period.highF}°`} />}
          {period.lowF !== undefined && <Chip label="Low" value={`${period.lowF}°`} />}
          {period.gustMph !== undefined && <Chip label="Gusts" value={`${period.gustMph} mph`} />}
          {period.precipPct !== undefined && <Chip label="Rain" value={`${period.precipPct}%`} />}
        </div>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink/80">{period.text}</p>
    </div>
  );
}

export function WeatherCard() {
  const [open, setOpen] = useState(false);
  const weather = trpc.dashboard.weather.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const d = weather.data;
  if (!d) return null; // loading, error, stale, off-season — all the same: no card

  const high = d.periods.find((p) => p.highF !== undefined)?.highF;
  const low = d.periods.find((p) => p.lowF !== undefined)?.lowF;
  const gust = d.periods.slice(0, 2).reduce<number | undefined>(
    (max, p) => (p.gustMph !== undefined && (max === undefined || p.gustMph > max) ? p.gustMph : max),
    undefined,
  );
  const summary = [
    high !== undefined ? `High ${high}°` : null,
    low !== undefined ? `Low ${low}°` : null,
    gust !== undefined ? `Gusts ${gust} mph` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="luxury-card overflow-hidden p-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-cream/50 sm:px-5"
      >
        <CloudSun className="h-4 w-4 shrink-0 text-gold" />
        <span className="min-w-0 truncate text-sm">
          <span className="font-medium text-ink">BRC weather</span>
          {summary && <span className="text-ink/80"> · {summary}</span>}
        </span>
        {d.advisories.length > 0 && (
          <span title="Weather advisory in effect">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-ink/70 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div className="border-t border-warm-border px-4 py-2 sm:px-5">
            <p className="text-[11px] text-ink/75">
              Updated {shortStamp(d.updatedAt)} PT ·{' '}
              <a
                href="http://brcweather.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ink/20 underline-offset-2 hover:text-ink/85"
              >
                Burning Man&rsquo;s official forecast
              </a>
            </p>
          </div>

          {d.advisories.map((a, i) => (
            <div
              key={i}
              className="flex gap-2.5 border-t border-amber-200 bg-amber-50 px-4 py-3 sm:px-5"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-[13px] leading-relaxed text-amber-900">
                {a.text}{' '}
                <span className="whitespace-nowrap text-amber-700/80">
                  (until {shortStamp(a.expiresAt)} PT)
                </span>
              </p>
            </div>
          ))}

          <div className="divide-y divide-warm-border border-t border-warm-border">
            {d.periods.map((p) => (
              <PeriodRow key={p.label} period={p} />
            ))}
          </div>

          {d.disclaimer && (
            <p className="border-t border-warm-border px-4 py-2.5 text-[10px] leading-snug text-ink/65 sm:px-5">
              {d.disclaimer}
            </p>
          )}
        </>
      )}
    </section>
  );
}
