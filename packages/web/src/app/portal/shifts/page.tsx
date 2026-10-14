'use client';

import { useState } from 'react';
import { ClipboardList, Loader2, Lock, AlertCircle, Check } from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { formatDayShort, toDateInputValue } from '../../../lib/dates';

/**
 * Member-facing shift signup.
 *
 * Two layouts, because roughly half of member-area sessions are on a phone and
 * a seven-column grid in a horizontal scroller is unusable on one. Small
 * screens pick a day first and read the slots as a list; from `sm:` up it is
 * the same grid the admin sees, which is how the camp has always read the
 * schedule on paper.
 */

type Instance = {
  id: string;
  date: Date | string;
  seasonMemberId: string | null;
  seasonMember: { member: { name: string; playaName: string | null } } | null;
};

export default function PortalShiftsPage() {
  const utils = trpc.useContext();
  const grid = trpc.shifts.myGrid.useQuery();
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  const onSettled = () => utils.shifts.myGrid.invalidate();
  const claim = trpc.shifts.claim.useMutation({
    onError: (e) => setError(e.message),
    onSuccess: () => setError(null),
    onSettled,
  });
  const release = trpc.shifts.release.useMutation({
    onError: (e) => setError(e.message),
    onSuccess: () => setError(null),
    onSettled,
  });
  const busy = claim.isLoading || release.isLoading;

  if (grid.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }
  if (grid.error) {
    return <div className="luxury-card p-4 text-red-700">{grid.error.message}</div>;
  }

  const d = grid.data!;

  if (!d.signupOpen) {
    return (
      <div className="luxury-card p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-ink/65" />
        <h1 className="mt-3 font-display text-xl text-ink">Shift signup is not open yet</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink/80">
          The schedule is still being put together. You will be able to pick your shifts here as
          soon as it opens.
        </p>
      </div>
    );
  }

  const met = d.myCount >= d.min;
  const activeDay = day && d.dates.includes(day) ? day : (d.dates[0] ?? null);

  /** One claimable cell, shared by both layouts. */
  const cell = (inst: Instance | undefined, full = false) => {
    if (!inst) {
      return (
        <span className="text-ink/65" aria-label="does not run">
          –
        </span>
      );
    }
    const mine = inst.seasonMemberId === d.mySeasonMemberId;
    const taken = !!inst.seasonMemberId && !mine;
    if (taken) {
      const who = inst.seasonMember?.member.playaName || inst.seasonMember?.member.name;
      return (
        <span
          className={`block truncate text-xs text-ink/70 ${full ? '' : 'px-1.5 py-1'}`}
          title={inst.seasonMember?.member.name}
        >
          {who}
        </span>
      );
    }
    return (
      <button
        disabled={busy}
        onClick={() =>
          mine
            ? release.mutate({ instanceId: inst.id })
            : claim.mutate({ instanceId: inst.id })
        }
        className={`truncate rounded text-xs disabled:opacity-50 ${
          full ? 'px-3 py-2 min-w-[92px]' : 'w-full px-1.5 py-1'
        } ${
          mine
            ? 'bg-gold/20 text-ink hover:bg-gold/30'
            : 'border border-dashed border-warm-border text-ink/70 hover:bg-cream/60'
        }`}
        title={mine ? 'Yours — tap to give it up' : 'Sign up'}
      >
        {mine ? 'Yours ✓' : 'Sign up'}
      </button>
    );
  };

  const instanceFor = (
    slot: { instances: Instance[] },
    date: string,
  ): Instance | undefined => slot.instances.find((i) => toDateInputValue(i.date) === date);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="inline-flex items-center gap-2 font-display text-2xl text-ink">
          <ClipboardList className="h-6 w-6 text-gold" />
          Shifts
        </h1>
        <p className="mt-1 text-sm text-ink/85">
          You have signed up for{' '}
          <strong className="tabular-nums">
            {d.myCount} of {d.min}
          </strong>{' '}
          shifts.{' '}
          {met ? (
            <span className="inline-flex items-center gap-1 text-sage">
              <Check className="h-3.5 w-3.5" />
              Thank you
            </span>
          ) : (
            <span className="text-ink/80">Pick any open slot below.</span>
          )}
        </p>
      </div>

      {error && (
        <div className="luxury-card border-red-300 p-3 text-sm text-red-700">
          <AlertCircle className="mr-1 inline h-4 w-4" />
          {error}
        </div>
      )}

      {d.blocks.length === 0 && (
        <div className="luxury-card p-6 text-center text-sm text-ink/80">
          No shifts have been published yet.
        </div>
      )}

      {/* ── phone: pick a day, then read the slots as a list ── */}
      {d.blocks.length > 0 && activeDay && (
        <div className="sm:hidden">
          <div
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2"
            role="tablist"
            aria-label="Choose a day"
          >
            {d.dates.map((date) => {
              const on = date === activeDay;
              return (
                <button
                  key={date}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setDay(date)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                    on
                      ? 'bg-gold text-[#1a2a1a]'
                      : 'border border-warm-border text-ink/85 hover:bg-cream/60'
                  }`}
                >
                  {formatDayShort(`${date}T12:00:00.000Z`)}
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {d.blocks.map((block) => {
              const rows = block.slots
                .map((slot) => ({ slot, inst: instanceFor(slot, activeDay) }))
                .filter((r) => r.inst);
              if (rows.length === 0) return null;
              return (
                <div key={block.id} className="luxury-card p-0">
                  <div className="border-b border-warm-border px-4 py-2.5">
                    <h2 className="font-display text-base text-ink">
                      {block.name}{' '}
                      <span className="text-sm font-normal tabular-nums text-ink/75">
                        {block.startTime}–{block.endTime}
                      </span>
                    </h2>
                    {block.notes && (
                      <p className="mt-0.5 text-xs leading-snug text-ink/80">{block.notes}</p>
                    )}
                  </div>
                  <ul className="divide-y divide-warm-border">
                    {rows.map(({ slot, inst }) => (
                      <li key={slot.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink">{slot.label}</span>
                          {slot.requirement && (
                            <span className="block text-[11px] leading-snug text-ink/75">
                              {slot.requirement}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0">{cell(inst, true)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── tablet and up: the familiar grid ── */}
      <div className="hidden space-y-5 sm:block">
        {d.blocks.map((block) => (
          <div key={block.id} className="luxury-card overflow-x-auto p-0">
            <div className="border-b border-warm-border px-4 py-3">
              <h2 className="font-display text-lg text-ink">
                {block.name}{' '}
                <span className="text-sm font-normal tabular-nums text-ink/75">
                  {block.startTime}–{block.endTime}
                </span>
              </h2>
              {block.notes && <p className="text-sm text-ink/80">{block.notes}</p>}
            </div>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-cream px-3 py-2 text-left text-xs uppercase tracking-wide text-ink/75">
                    Slot
                  </th>
                  {d.dates.map((date) => (
                    <th
                      key={date}
                      className="px-2 py-2 text-center text-xs uppercase tracking-wide text-ink/75"
                    >
                      {formatDayShort(`${date}T12:00:00.000Z`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.slots.map((slot) => (
                  <tr key={slot.id} className="border-t border-warm-border">
                    <td
                      className="sticky left-0 z-10 bg-white px-3 py-1.5 text-ink"
                      title={slot.requirement ?? undefined}
                    >
                      {slot.label}
                      {slot.requirement && (
                        <span className="block max-w-[260px] text-[11px] leading-snug text-ink/75">
                          {slot.requirement}
                        </span>
                      )}
                    </td>
                    {d.dates.map((date) => (
                      <td key={date} className="px-1 py-1 text-center">
                        {cell(instanceFor(slot, date))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
