'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  Car,
  CalendarRange,
  Download,
  Gift,
  Loader2,
  Lock,
  Pencil,
  Plane,
  Sparkles,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { formatDateOnly, toDateInputValue } from '../../lib/dates';
import { getCampConfig } from '@/lib/config';

const campConfig = getCampConfig();

/**
 * Travel plans, member-facing. Collects the four things camp logistics
 * actually needs — when you arrive, when you leave, how you're getting there,
 * and whether you have spare room or need a ride — in one quick form.
 * Submitting unlocks the camp phone wallpapers as a thank-you.
 */

const MODES = [
  { value: 'CAR', label: 'Car / truck' },
  { value: 'RV', label: 'RV' },
  { value: 'CARPOOL', label: 'Carpool' },
  { value: 'FLYING', label: 'Flying' },
  { value: 'BURNER_EXPRESS', label: 'Burner Express' },
  { value: 'OTHER', label: 'Other' },
] as const;

const RIDE = [
  { value: 'HAVE_ROOM', label: 'I have room for people / cargo' },
  { value: 'NEED_RIDE', label: 'Looking for a ride' },
  { value: 'SORTED', label: 'All sorted' },
] as const;

const WINDOWS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'AFTERNOON', label: 'Afternoon' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'NIGHT', label: 'Night' },
] as const;

const WALLPAPERS = [
  { src: '/wallpapers/camp-night.jpg', name: 'Camp Night', file: 'camp-night.jpg' },
  { src: '/wallpapers/camp-day.jpg', name: 'Camp Day', file: 'camp-day.jpg' },
];

type TravelMode = (typeof MODES)[number]['value'];
type RideStatus = (typeof RIDE)[number]['value'];
type TravelWindow = (typeof WINDOWS)[number]['value'];

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    on
      ? 'border-gold bg-gold/25 text-[#f5e6c8]'
      : 'border-[#4a7c59] text-[#f5e6c8]/85 hover:border-gold hover:text-gold'
  }`;

export function TravelCard() {
  const utils = trpc.useContext();
  const status = trpc.seasonMembers.getMySeasonStatus.useQuery();
  const save = trpc.seasonMembers.updateMyTravel.useMutation({
    onSuccess: () => {
      utils.seasonMembers.getMySeasonStatus.invalidate();
      setEditing(false);
    },
  });

  const [editing, setEditing] = useState(false);
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [arrivalWin, setArrivalWin] = useState<TravelWindow | null>(null);
  const [departureWin, setDepartureWin] = useState<TravelWindow | null>(null);
  const [mode, setMode] = useState<TravelMode | null>(null);
  const [ride, setRide] = useState<RideStatus | null>(null);
  const [details, setDetails] = useState('');

  const sm = status.data;
  if (status.isLoading || !sm) return null; // not on the roster → no card

  const filled = !!sm.travelUpdatedAt;
  const showForm = !filled || editing;
  const canSubmit = arrival && departure && mode && ride && !save.isLoading;

  const startEdit = () => {
    setArrival(sm.arrivalDate ? toDateInputValue(sm.arrivalDate) : '');
    setDeparture(sm.departureDate ? toDateInputValue(sm.departureDate) : '');
    setArrivalWin((sm.arrivalWindow as TravelWindow) ?? null);
    setDepartureWin((sm.departureWindow as TravelWindow) ?? null);
    setMode((sm.travelMode as TravelMode) ?? null);
    setRide((sm.rideStatus as RideStatus) ?? null);
    setDetails(sm.rideDetails ?? '');
    setEditing(true);
  };

  const submit = () => {
    if (!arrival || !departure || !mode || !ride) return;
    save.mutate({
      arrivalDate: arrival,
      departureDate: departure,
      arrivalWindow: arrivalWin,
      departureWindow: departureWin,
      travelMode: mode,
      rideStatus: ride,
      rideDetails: details || null,
    });
  };

  /** Tap-again-to-clear chip row for an optional time-of-day. */
  const windowRow = (value: TravelWindow | null, set: (w: TravelWindow | null) => void) => (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          type="button"
          onClick={() => set(value === w.value ? null : w.value)}
          className={chip(value === w.value)}
        >
          {w.label}
        </button>
      ))}
    </div>
  );

  return (
    <section className="luxury-card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warm-border px-4 py-3 sm:px-5">
        <h2 className="inline-flex items-center gap-2 font-display text-lg text-ink">
          <CalendarRange className="h-5 w-5 text-gold" />
          Travel Plans
        </h2>
        {filled && !editing && (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink/80 hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>

      {showForm ? (
        <div className="space-y-4 px-4 py-4 sm:px-5">
          {!filled && (
            <p className="flex items-start gap-2 rounded border border-gold/50 bg-gold/15 px-3 py-2 text-[13px] leading-snug text-[#f5e6c8]">
              <Gift className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>
                Tell us your travel plans — 30 seconds — and unlock the{' '}
                <strong>{campConfig.name} phone wallpapers</strong> as a thank-you.
              </span>
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block">
                <span className="form-label">Arriving</span>
                <input
                  type="date"
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                  className="form-input w-full"
                />
              </label>
              {windowRow(arrivalWin, setArrivalWin)}
            </div>
            <div>
              <label className="block">
                <span className="form-label">Leaving</span>
                <input
                  type="date"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  className="form-input w-full"
                />
              </label>
              {windowRow(departureWin, setDepartureWin)}
            </div>
          </div>

          <div>
            <span className="form-label">Getting there by</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <button key={m.value} type="button" onClick={() => setMode(m.value)} className={chip(mode === m.value)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="form-label">Rides</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {RIDE.map((r) => (
                <button key={r.value} type="button" onClick={() => setRide(r.value)} className={chip(ride === r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {(ride === 'HAVE_ROOM' || ride === 'NEED_RIDE' || details) && (
            <label className="block">
              <span className="form-label">
                {ride === 'HAVE_ROOM' ? 'What room do you have? (seats, truck bed, trailer…)' : 'Anything we should know?'}
              </span>
              <input
                type="text"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                placeholder={ride === 'HAVE_ROOM' ? 'e.g. 2 seats + half a truck bed from LA' : 'e.g. from SF, flexible dates'}
                className="form-input w-full"
              />
            </label>
          )}

          {save.error && (
            <p className="flex items-center gap-1.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {save.error.message}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={!canSubmit} className="cta-primary disabled:opacity-50">
              {save.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : filled ? 'Save' : 'Save & unlock'}
            </button>
            {editing && (
              <button onClick={() => setEditing(false)} className="text-sm text-ink/80 hover:text-ink">
                Cancel
              </button>
            )}
            {!filled && (
              <span className="inline-flex items-center gap-1 text-xs text-ink/70">
                <Lock className="h-3.5 w-3.5" />
                Wallpapers locked
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink/80">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4 text-ink/70" />
              {formatDateOnly(sm.arrivalDate)}
              {sm.arrivalWindow && (
                <span className="text-ink/75">{WINDOWS.find((w) => w.value === sm.arrivalWindow)?.label.toLowerCase()}</span>
              )}
              {' → '}
              {formatDateOnly(sm.departureDate)}
              {sm.departureWindow && (
                <span className="text-ink/75">{WINDOWS.find((w) => w.value === sm.departureWindow)?.label.toLowerCase()}</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {sm.travelMode === 'FLYING' || sm.travelMode === 'BURNER_EXPRESS' ? (
                <Plane className="h-4 w-4 text-ink/70" />
              ) : (
                <Car className="h-4 w-4 text-ink/70" />
              )}
              {MODES.find((m) => m.value === sm.travelMode)?.label ?? sm.travelMode}
            </span>
            <span className="text-ink/80">{RIDE.find((r) => r.value === sm.rideStatus)?.label}</span>
          </div>
          {sm.rideDetails && <p className="mt-1.5 text-[13px] text-ink/80">{sm.rideDetails}</p>}
        </div>
      )}

      {/* the gift — revealed once travel plans are in */}
      {filled && (
        <div className="border-t border-[#2f5a42] bg-[#0f2a1e] px-4 py-4 sm:px-5">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-gold">
            <Sparkles className="h-4 w-4" />
            Wallpapers unlocked — thank you!
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
            {WALLPAPERS.map((w) => (
              <a
                key={w.file}
                href={w.src}
                download={w.file}
                className="group block overflow-hidden rounded border border-cream/15"
                title={`Download ${w.name}`}
              >
                <Image
                  src={w.src}
                  alt={`${w.name} phone wallpaper`}
                  width={280}
                  height={498}
                  className="w-full transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <span className="flex items-center justify-center gap-1.5 bg-cream/5 px-2 py-1.5 text-xs text-cream/85">
                  <Download className="h-3.5 w-3.5" />
                  {w.name}
                </span>
              </a>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-cream/45">
            Tap to download, then set as your lock screen.
          </p>
        </div>
      )}
    </section>
  );
}
