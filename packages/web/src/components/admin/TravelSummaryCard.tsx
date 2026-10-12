'use client';

import { useState } from 'react';
import { CalendarRange, Car, ChevronDown, PackageOpen, UserRoundSearch } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { formatDateOnly } from '../../lib/dates';

/**
 * Admin roll-up of the portal travel form: arrivals grouped by day, plus the
 * two lists logistics actually acts on — cargo space offered and rides needed
 * — and who hasn't answered yet (fodder for a nudge email).
 */

const MODE_LABEL: Record<string, string> = {
  CAR: 'car',
  RV: 'RV',
  CARPOOL: 'carpool',
  FLYING: 'flying',
  BURNER_EXPRESS: 'Burner Express',
  OTHER: 'other',
};

const WINDOW_LABEL: Record<string, string> = {
  MORNING: 'am',
  AFTERNOON: 'pm',
  EVENING: 'eve',
  NIGHT: 'night',
};

export function TravelSummaryCard() {
  const q = trpc.seasonMembers.travelSummary.useQuery();
  const [showUnanswered, setShowUnanswered] = useState(false);
  const d = q.data;
  if (q.isLoading || !d) return null;

  const { answered, unanswered } = d;
  const haveRoom = answered.filter((r) => r.rideStatus === 'HAVE_ROOM');
  const needRide = answered.filter((r) => r.rideStatus === 'NEED_RIDE');

  // Arrivals grouped by calendar day, in date order (nulls can't occur for
  // answered rows — the form requires both dates).
  const byDay = new Map<string, typeof answered>();
  for (const r of answered) {
    const key = r.arrivalDate ? formatDateOnly(r.arrivalDate, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date';
    byDay.set(key, [...(byDay.get(key) ?? []), r]);
  }

  const who = (r: { member: { name: string; playaName: string | null } }) =>
    r.member.playaName || r.member.name;

  return (
    <section className="luxury-card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warm-border px-4 py-3">
        <h2 className="inline-flex items-center gap-2 font-display text-lg text-ink">
          <CalendarRange className="h-5 w-5 text-gold" />
          Travel
        </h2>
        <p className="text-xs text-ink/55">
          <strong className="tabular-nums">{answered.length}</strong> answered ·{' '}
          <strong className="tabular-nums">{unanswered.length}</strong> pending
        </p>
      </div>

      {answered.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink/55">
          No travel plans submitted yet. The portal form is live — a nudge email to the{' '}
          {unanswered.length} pending members is the fastest way to fill this in.
        </p>
      ) : (
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="border-b border-warm-border px-4 py-3 sm:border-b-0 sm:border-r">
            <h3 className="text-xs font-medium uppercase tracking-wide text-ink/50">Arrivals</h3>
            <ul className="mt-2 space-y-1.5">
              {[...byDay.entries()].map(([day, rows]) => (
                <li key={day} className="text-sm text-ink/80">
                  <span className="inline-block w-24 font-medium tabular-nums text-ink">{day}</span>
                  <span className="text-ink/70">
                    {rows
                      .map((r) => {
                        const extras = [
                          r.arrivalWindow ? WINDOW_LABEL[r.arrivalWindow] : null,
                          r.travelMode ? MODE_LABEL[r.travelMode] : null,
                        ].filter(Boolean);
                        return `${who(r)}${extras.length ? ` (${extras.join(', ')})` : ''}`;
                      })
                      .join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-4 py-3">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
              <PackageOpen className="h-3.5 w-3.5" />
              Cargo / seats offered
            </h3>
            {haveRoom.length === 0 ? (
              <p className="mt-1.5 text-sm text-ink/50">Nobody yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {haveRoom.map((r) => (
                  <li key={r.id} className="text-sm text-ink/80">
                    <Car className="mr-1 inline h-3.5 w-3.5 text-sage" />
                    <span className="font-medium">{who(r)}</span>
                    {r.rideDetails && <span className="text-ink/60"> — {r.rideDetails}</span>}
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink/50">
              <UserRoundSearch className="h-3.5 w-3.5" />
              Looking for rides
            </h3>
            {needRide.length === 0 ? (
              <p className="mt-1.5 text-sm text-ink/50">Nobody yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {needRide.map((r) => (
                  <li key={r.id} className="text-sm text-ink/80">
                    <span className="font-medium">{who(r)}</span>
                    {r.rideDetails && <span className="text-ink/60"> — {r.rideDetails}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {unanswered.length > 0 && (
        <div className="border-t border-warm-border px-4 py-2.5">
          <button
            onClick={() => setShowUnanswered((v) => !v)}
            aria-expanded={showUnanswered}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink"
          >
            {unanswered.length} haven&rsquo;t answered
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showUnanswered ? 'rotate-180' : ''}`} />
          </button>
          {showUnanswered && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink/60">
              {unanswered.map((r) => r.member.playaName || r.member.name).join(', ')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
