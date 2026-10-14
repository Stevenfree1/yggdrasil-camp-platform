'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  Loader2,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  ClipboardCheck,
  Home,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import { formatDateOnly } from '../../lib/dates';
import { WeatherCard } from '../../components/portal/WeatherCard';
import { TravelCard } from '../../components/portal/TravelCard';
import { memberResources } from '../../../../../config/member-resources.config';
import { getCampConfig } from '@/lib/config';

const campConfig = getCampConfig();


interface Payment {
  id: string;
  amount: number;
  type: string;
  method: string;
  paidAt: string;
  note?: string | null;
}

interface SeasonStatus {
  id: string;
  status: string;
  housingType: string | null;
  buildCrew: boolean;
  strikeCrew: boolean;
  payments: Payment[];
  season: {
    id: string;
    year: number;
    name: string;
    duesAmount: number;
    startDate: string | null;
    endDate: string | null;
  };
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  publishedAt: string | null;
  createdAt: string;
  author?: {
    name: string;
    playaName: string | null;
  };
}

/** The two resources members actually reach for — the rest live one tap away. */
const featuredResources = memberResources.filter((r) => r.featured).slice(0, 2);

const statusLabels: Record<string, string> = {
  INTERESTED: 'Interested',
  MAYBE: 'Maybe',
  CONFIRMED: 'Confirmed',
  WAITLISTED: 'Waitlisted',
  CANCELLED: 'Cancelled',
};


function formatRelativeDate(date: string | null | undefined): string {
  if (!date) return 'Recently';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return 'Not set';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Days until the Man burns: the Saturday before Labor Day (first Monday of September), 9pm PDT. */
function daysUntilManBurns(now: Date): number {
  const burnFor = (year: number) => {
    const sept1Dow = new Date(Date.UTC(year, 8, 1)).getUTCDay(); // 0 = Sunday
    const laborDay = 1 + ((8 - sept1Dow) % 7); // first Monday
    // Saturday before, 9pm PDT (UTC-7); Date.UTC rolls month boundaries.
    return Date.UTC(year, 8, laborDay - 2, 21 + 7);
  };
  let burn = burnFor(now.getFullYear());
  // Once the burn is more than a day behind us, count down to next year's.
  if (now.getTime() - burn > 86_400_000) burn = burnFor(now.getFullYear() + 1);
  return Math.max(0, Math.ceil((burn - now.getTime()) / 86_400_000));
}

export default function PortalDashboard() {
  const { user } = useAuth();
  const [seasonStatus, setSeasonStatus] = useState<SeasonStatus | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The Man burns on the Saturday before Labor Day (~9pm PT). Computed
  // client-side so the day count never mismatches between SSR/hydrate.
  const [daysToBurn, setDaysToBurn] = useState<number | null>(null);
  useEffect(() => {
    setDaysToBurn(daysUntilManBurns(new Date()));
  }, []);

  const loadPortalData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Server uses superjson — wrap inputs in { json: ... } and read
      // responses from { result: { data: { json: ... } } }.
      const announcementInput = encodeURIComponent(
        JSON.stringify({ json: { limit: 3, offset: 0 } }),
      );
      const [seasonResult, announcementResult] = await Promise.all([
        fetch(`/api/trpc/seasonMembers.getMySeasonStatus`),
        fetch(`/api/trpc/announcements.list?input=${announcementInput}`)
          .then(async (res) => {
            if (!res.ok) return null;
            const json = await res.json();
            return json.result?.data?.json as { announcements: Announcement[]; total: number };
          })
          .catch(() => null),
      ]);

      if (!seasonResult.ok) throw new Error('Failed to load season status');
      const seasonJson = await seasonResult.json();
      setSeasonStatus(seasonJson.result?.data?.json ?? null);
      setAnnouncements(announcementResult?.announcements ?? []);
    } catch {
      setError('Unable to load season data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  if (!user) return null;

  const payments = seasonStatus?.payments ?? [];
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const duesAmount = seasonStatus?.season?.duesAmount ?? 0;
  const remaining = Math.max(0, duesAmount - totalPaid);
  const paidPercent = duesAmount > 0 ? Math.min(100, Math.round((totalPaid / duesAmount) * 100)) : 0;
  const statusLabel = seasonStatus ? statusLabels[seasonStatus.status] || formatLabel(seasonStatus.status) : 'Not enrolled';
  const seasonName = seasonStatus?.season?.name ?? 'Current Season';
  const seasonStart = seasonStatus?.season?.startDate;
  const seasonEnd = seasonStatus?.season?.endDate;

  const readiness = [
    {
      label: 'Enrollment',
      value: statusLabel,
      detail: seasonStatus ? 'Your current season status' : 'No active enrollment found',
      icon: CheckCircle2,
      complete: seasonStatus?.status === 'CONFIRMED',
    },
    {
      label: 'Camp dues',
      value: duesAmount > 0 && remaining === 0 ? 'Paid' : remaining > 0 ? `${formatCurrency(remaining)} due` : 'Pending',
      detail: duesAmount > 0 ? `${paidPercent}% recorded — view payments` : 'Dues amount not set',
      icon: DollarSign,
      complete: duesAmount > 0 && remaining === 0,
      href: '/portal/payments',
    },
    {
      label: 'Housing',
      value: formatLabel(seasonStatus?.housingType),
      detail: seasonStatus?.housingType ? 'Update your setup' : 'Tell us what you’re sleeping in',
      icon: Home,
      complete: Boolean(seasonStatus?.housingType),
      href: '/portal/profile#housing',
    },
    {
      label: 'Crew commitments',
      value: [
        seasonStatus?.buildCrew ? 'Build' : null,
        seasonStatus?.strikeCrew ? 'Strike' : null,
      ].filter(Boolean).join(' + ') || 'Not set',
      detail: 'Build and strike participation',
      icon: ClipboardCheck,
      complete: Boolean(seasonStatus?.buildCrew || seasonStatus?.strikeCrew),
    },
  ];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-lg border border-[#2f5a42]/50 bg-[#0f2a1e] text-[#f5e6c8] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[url('/images/texture.webp')] bg-cover bg-center opacity-15" aria-hidden="true" />
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-5 sm:p-7">
            <span className="inline-block rounded-full border border-[#e8c56a]/60 bg-[#e8c56a]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f0d488]">
              {seasonName} · {statusLabel}
            </span>

            <h1 className="mt-4 text-display-thin text-3xl leading-[1.08] text-[#f5e6c8] sm:text-4xl lg:text-5xl">
              Welcome back, {user.playaName || user.name}
            </h1>
            {daysToBurn !== null && daysToBurn > 0 && (
              <p className="mt-4 flex items-baseline gap-2.5">
                <span className="font-display text-3xl leading-none text-gold sm:text-4xl">{daysToBurn}</span>
                <span className="text-xs uppercase tracking-[0.18em] text-[#f5e6c8]/80 sm:text-sm">
                  {daysToBurn === 1 ? 'day until the Man burns' : 'days until the Man burns'}
                </span>
              </p>
            )}
            {daysToBurn === 0 && (
              <p className="mt-4 font-display text-2xl text-gold">The Man burns tonight 🔥</p>
            )}
          </div>

          <div className="relative hidden min-h-[200px] overflow-hidden border-l border-cream/10 lg:block">
            <Image
              src="/images/portal-group.webp"
              alt={`${campConfig.name} community group photo on the playa`}
              fill
              priority
              sizes="340px"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
          </div>
        </div>
      </section>

      {/* Self-hiding: renders nothing off-season or when the forecast is unavailable */}
      <WeatherCard />

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">{error}</p>
          </div>
          <button
            onClick={loadPortalData}
            className="text-left text-sm font-medium text-amber-800 transition-colors hover:text-ink sm:ml-auto"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-ink-soft">Loading your portal...</p>
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="luxury-card overflow-hidden p-0">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-caption">Camp Updates</p>
                  <h2 className="text-display-thin text-2xl text-ink">Announcements</h2>
                </div>
                <Link
                  href="/members/announcements"
                  className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.12em] text-gold transition-colors hover:text-ink"
                >
                  All updates
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-80 shadow-[0_0_8px_rgba(185,148,67,0.5)]" />

              <div>
                {announcements.length > 0 ? (
                  announcements.map((announcement, i) => (
                    <article key={announcement.id} className="p-5">
                      {i > 0 && (
                        <div className="mb-5 -mt-5 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-70 shadow-[0_0_8px_rgba(185,148,67,0.45)]" />
                      )}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-gold">
                              {formatLabel(announcement.priority)}
                            </span>
                            <span className="text-xs text-ink-soft">
                              {formatRelativeDate(announcement.publishedAt || announcement.createdAt)}
                            </span>
                          </div>
                          <h3 className="text-lg font-medium text-ink">{announcement.title}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-soft">
                            {announcement.content}
                          </p>
                        </div>
                        <Megaphone className="hidden h-5 w-5 shrink-0 text-gold sm:block" />
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="p-5">
                    <div className="rounded-md border border-sage/20 bg-sage/10 p-5">
                      <p className="font-medium text-ink">No published announcements</p>
                      <p className="mt-1 text-sm leading-6 text-ink-soft">
                        When camp leads publish updates, they will appear here first.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="luxury-card overflow-hidden p-0">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-caption">Read Before Playa</p>
                  <h2 className="text-display-thin text-2xl text-ink">Resources</h2>
                </div>
                <Link
                  href="/members/resources"
                  className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.12em] text-gold transition-colors hover:text-ink"
                >
                  All resources
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-80 shadow-[0_0_8px_rgba(185,148,67,0.5)]" />
              <div className="divide-y divide-tan/25">
                {featuredResources.map((resource) => {
                  const external = resource.url.startsWith('http');
                  return (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noopener noreferrer' : undefined}
                      className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-cream/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gold/25 bg-gold/10 text-gold">
                        <BookOpen className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink transition-colors group-hover:text-gold">
                          {resource.title}
                        </span>
                        <span className="block truncate text-xs text-ink-soft">
                          {resource.description}
                        </span>
                      </span>
                      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-gold" />
                    </a>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Travel plans + wallpaper gift (hides itself for non-roster members) */}
          <TravelCard />

          <section className="luxury-card overflow-hidden p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-tan/30 px-5 py-4">
              <div>
                <p className="text-caption">Season Passport</p>
                <h2 className="text-display-thin text-2xl text-ink">{seasonName}</h2>
              </div>
              {(seasonStart || seasonEnd) && (
                <p className="text-sm text-ink-soft">
                  {formatDateOnly(seasonStart)} – {formatDateOnly(seasonEnd)}
                </p>
              )}
            </div>

            {seasonStatus ? (
              <div className="grid gap-px bg-tan/25 p-px sm:grid-cols-2 lg:grid-cols-4">
                {readiness.map(({ label, value, detail, icon: Icon, complete, href }) => {
                  const body = (
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
                          {label}
                        </p>
                        <p className="mt-1.5 text-lg font-medium text-ink">{value}</p>
                        <p className="mt-0.5 text-sm leading-5 text-ink-soft">{detail}</p>
                      </div>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                        complete
                          ? 'border-sage/25 bg-sage/10 text-sage'
                          : 'border-gold/25 bg-gold/10 text-gold'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                  );
                  return href ? (
                    <Link key={label} href={href} className="block bg-surface p-4 transition-colors hover:bg-cream/60">
                      {body}
                    </Link>
                  ) : (
                    <div key={label} className="bg-surface p-4">{body}</div>
                  );
                })}
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-md border border-tan/35 bg-cream p-5">
                  <p className="font-medium text-ink">No current enrollment found</p>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">
                    If you expect to camp this season, contact camp leadership so they can connect your profile to the active season.
                  </p>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
