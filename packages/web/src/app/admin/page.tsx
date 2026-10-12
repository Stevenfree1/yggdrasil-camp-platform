'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  type LucideIcon,
  Users,
  FileText,
  ArrowRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  Clock,
  UserPlus,
  Calendar,
  DollarSign,
  FileCheck,
  MessageSquare,
  Mail,
  CreditCard,
  ClipboardCheck,
  Ticket,
  Send,
  ShieldCheck,
  Activity,
  PackageSearch,
} from 'lucide-react';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { useAdminSeason } from '../../contexts/AdminSeasonContext';
import { useAuth, canAccessScope } from '../../contexts/AuthContext';
import {
  fetchDashboardData,
  fetchActionItems,
  getApiErrorMessage,
  type DashboardData,
  type RecentApplication,
  type ActionItems,
} from '../../lib/adminApi';
import { formatCurrency } from '../../lib/utils';
import { TravelSummaryCard } from '../../components/admin/TravelSummaryCard';
import { getCampConfig } from '@/lib/config';

const campConfig = getCampConfig();

const statusBarColors: Record<string, string> = {
  confirmed: 'bg-[#697763]',
  maybe: 'bg-[#B88A45]',
  interested: 'bg-[#87977E]',
  waitlisted: 'bg-[#C0964B]',
  cancelled: 'bg-[#8A8173]',
};

const experienceLabels: Record<string, string> = {
  FIRST_TIMER: 'First Timer',
  BEEN_BEFORE: 'Been Before',
  VETERAN: 'Veteran',
};

const placeholderData: DashboardData = {
  totalMembers: 0,
  confirmed: 0,
  maybe: 0,
  interested: 0,
  waitlisted: 0,
  cancelled: 0,
  totalCollected: 0,
  totalPayments: 0,
  pendingApplications: 0,
  duesProgress: { collected: 0, expected: 0, confirmedMembers: 0, percent: 0 },
  recentPayments: [],
  recentApplications: [],
  season: null,
};

function formatLedgerDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });
}

/**
 * Landing page for a scope holder. The full dashboard aggregates money and
 * member counts behind lead-gated queries, so rather than degrade it we hand
 * scope holders a short menu of what they actually own.
 */
function ScopedHome({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const areas = [
    { scope: 'INVENTORY' as const, label: 'Inventory', href: '/admin/inventory', icon: PackageSearch,
      blurb: 'Camp equipment ledger — counts, condition, storage location.' },
    { scope: 'SHIFTS' as const, label: 'Shifts', href: '/admin/shifts', icon: ClipboardCheck,
      blurb: 'Volunteer shifts, assignments, and coverage.' },
  ].filter((a) => canAccessScope(user, a.scope));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Welcome, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-ink/60 mt-1">
          {areas.length === 1
            ? `You have access to ${areas[0].label.toLowerCase()}.`
            : 'Here are the areas you have access to.'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {areas.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.scope} href={a.href}
              className="luxury-card p-5 hover:border-gold/60 transition-colors group">
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-display text-lg text-ink flex items-center gap-1.5">
                    {a.label}
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm text-ink/60 mt-1">{a.blurb}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { selectedSeasonId } = useAdminSeason();
  const [data, setData] = useState<DashboardData>(placeholderData);
  const [actionItems, setActionItems] = useState<ActionItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [result, actionResult] = await Promise.all([
        fetchDashboardData(selectedSeasonId || undefined),
        fetchActionItems(selectedSeasonId || undefined).catch(() => null),
      ]);
      setData(result);
      setActionItems(actionResult);
      setError(null);
    } catch (err) {
      const apiMessage = getApiErrorMessage(err);
      setError(
        apiMessage
          ? `Unable to load dashboard data (${apiMessage}). Showing placeholder data.`
          : 'Unable to connect to the server. Showing placeholder data.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSeasonId]);

  // Scope holders never fetch the dashboard: every query behind it is
  // lead-gated and would just throw.
  const isFullAdmin = user?.role === 'LEAD' || user?.role === 'MANAGER';

  useEffect(() => {
    if (!isFullAdmin) return;
    loadDashboard();
  }, [loadDashboard, isFullAdmin]);

  if (user && !isFullAdmin) {
    return <ScopedHome user={user} />;
  }

  const statusBreakdown = [
    { label: 'Confirmed', key: 'confirmed', count: data.confirmed },
    { label: 'Maybe', key: 'maybe', count: data.maybe },
    { label: 'Interested', key: 'interested', count: data.interested },
    { label: 'Waitlisted', key: 'waitlisted', count: data.waitlisted },
    { label: 'Cancelled', key: 'cancelled', count: data.cancelled },
  ];

  const maxCount = Math.max(...statusBreakdown.map((s) => s.count), 1);
  const enrolledCount = data.confirmed + data.maybe + data.interested + data.waitlisted;

  // Build action items alerts (only show where count > 0)
  const alertCards = actionItems
    ? [
        {
          key: 'unpaidDues',
          count: actionItems.unpaidDues.count,
          label: 'Unpaid Dues',
          description: 'Members need payment follow-up',
          icon: DollarSign,
          href: '/admin/communications',
        },
        {
          key: 'noTicket',
          count: actionItems.noTicket.count,
          label: 'Tickets Needed',
          description: 'Ticket confirmations still missing',
          icon: Ticket,
          href: '/admin/communications',
        },
        {
          key: 'noPreApproval',
          count: actionItems.noPreApproval.count,
          label: 'No Pre-Approval',
          description: 'Vehicle or camp access needs review',
          icon: FileCheck,
          href: '/admin/communications',
        },
        {
          key: 'pendingApps',
          count: actionItems.pendingApplications.count,
          label: 'Pending Apps',
          description: 'Applications awaiting lead review',
          icon: FileText,
          href: '/admin/applications',
        },
        {
          key: 'notOnWhatsApp',
          count: actionItems.notOnWhatsApp.count,
          label: 'Not on WhatsApp',
          description: 'Members missing from broadcast channel',
          icon: MessageSquare,
          href: '/admin/communications',
        },
      ].filter((c) => c.count > 0)
    : [];

  const operations = [
    {
      code: 'A',
      label: 'Applications',
      count: data.pendingApplications,
      detail: data.pendingApplications > 0 ? 'Awaiting review' : 'Queue clear',
      icon: FileText,
      href: '/admin/applications',
      action: 'Review',
      urgent: data.pendingApplications > 0,
    },
    {
      code: 'D',
      label: 'Dues & Payments',
      count: actionItems?.unpaidDues.count ?? 0,
      detail: `${data.duesProgress.percent}% of dues goal`,
      icon: CreditCard,
      href: '/admin/communications',
      action: 'Collect',
      progress: data.duesProgress.percent,
      urgent: (actionItems?.unpaidDues.count ?? 0) > 0,
    },
    {
      code: 'T',
      label: 'Ticketing',
      count: actionItems?.noTicket.count ?? 0,
      detail: (actionItems?.noTicket.count ?? 0) > 0 ? 'Confirm ticket status' : 'Tickets reconciled',
      icon: Ticket,
      href: '/admin/communications',
      action: 'Check',
      urgent: (actionItems?.noTicket.count ?? 0) > 0,
    },
    {
      code: 'C',
      label: 'Comms',
      count: actionItems?.notOnWhatsApp.count ?? 0,
      detail: (actionItems?.notOnWhatsApp.count ?? 0) > 0 ? 'WhatsApp adds needed' : 'Broadcast list current',
      icon: Send,
      href: '/admin/communications',
      action: 'Message',
      urgent: (actionItems?.notOnWhatsApp.count ?? 0) > 0,
    },
  ];

  // Season timeline phases
  const timelinePhases = [
    { key: 'soi', label: 'SOI' },
    { key: 'ticketing', label: 'Ticketing' },
    { key: 'dues', label: 'Dues' },
    { key: 'build', label: 'Build' },
    { key: 'burn', label: 'BURN' },
    { key: 'strike', label: 'Strike' },
    { key: 'postPlaya', label: 'Post-Playa' },
  ];

  // Determine current phase from season dates (simple heuristic)
  const getCurrentPhase = (): string | null => {
    if (!data.season) return null;
    const season = data.season as { id: string; name: string; year: number; [key: string]: unknown };
    const now = new Date();
    // If the season object has date fields, use them; otherwise return null
    const burnStart = season.burnStartDate ? new Date(season.burnStartDate as string) : null;
    const burnEnd = season.burnEndDate ? new Date(season.burnEndDate as string) : null;
    const buildStart = season.buildStartDate ? new Date(season.buildStartDate as string) : null;
    const strikeEnd = season.strikeEndDate ? new Date(season.strikeEndDate as string) : null;

    if (burnEnd && now > burnEnd) {
      if (strikeEnd && now <= strikeEnd) return 'strike';
      if (strikeEnd && now > strikeEnd) return 'postPlaya';
      return 'postPlaya';
    }
    if (burnStart && now >= burnStart) return 'burn';
    if (buildStart && now >= buildStart) return 'build';
    // Before build, estimate based on season year
    const seasonYear = data.season.year;
    const month = now.getMonth(); // 0-indexed
    if (now.getFullYear() === seasonYear || (now.getFullYear() === seasonYear - 1 && month >= 9)) {
      if (month >= 6) return 'dues'; // July onwards
      if (month >= 3) return 'ticketing'; // April onwards
      return 'soi'; // Jan-March
    }
    return null;
  };

  const currentPhase = getCurrentPhase();
  const currentPhaseIndex = currentPhase
    ? timelinePhases.findIndex((phase) => phase.key === currentPhase)
    : -1;
  const seasonLabel = data.season ? data.season.name : 'Current Season';
  const confirmedPercent = enrolledCount > 0
    ? Math.round((data.confirmed / enrolledCount) * 100)
    : 0;
  const burnYear = data.season?.year || new Date().getFullYear();
  const readinessItems = [
    {
      label: 'Enrollment',
      value: enrolledCount,
      detail: `${data.confirmed} confirmed`,
      icon: Users,
    },
    {
      label: 'Dues',
      value: `${data.duesProgress.percent}%`,
      detail: data.duesProgress.expected > 0
        ? `${formatCurrency(data.duesProgress.collected)} collected`
        : 'No dues goal set',
      icon: DollarSign,
    },
    {
      label: 'Action Alerts',
      value: alertCards.length,
      detail: alertCards.length > 0 ? 'Open follow-ups' : 'Queues clear',
      icon: AlertCircle,
    },
  ];

  return (
    <div className="admin-dashboard space-y-5">
      <section className="admin-hero-panel p-5 sm:p-6 lg:p-7">
        <div className="grid min-h-[210px] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="admin-page-kicker">{campConfig.name} Ops</span>
              <span className="admin-signal-pill">
                <Activity className="h-3.5 w-3.5 text-gold" />
                {currentPhase ? `${timelinePhases.find((p) => p.key === currentPhase)?.label} active` : 'Season planning'}
              </span>
              <span className="admin-signal-pill">
                <Calendar className="h-3.5 w-3.5 text-gold" />
                Burning Man {burnYear}
              </span>
            </div>
            <h1 className="mt-5 text-display-thin text-4xl leading-[1.05] text-cream sm:text-5xl">
              {seasonLabel} Ledger
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/70 sm:text-base">
              One operational surface for membership, money, applications, tickets, and readiness.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {readinessItems.map(({ label, value, detail, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-black/20 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/90">
                    {label}
                  </p>
                  <p className="mt-1 truncate text-xs text-cream/60">{detail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-display-thin text-3xl leading-none text-cream tabular-nums">
                    {value}
                  </p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gold/30 bg-gold/10">
                    <Icon className="h-4 w-4 text-gold" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/brand/logo-256.webp"
              alt=""
              width={34}
              height={48}
              className="h-10 w-auto object-contain opacity-85"
              aria-hidden="true"
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cream/50">
                Season Readiness
              </p>
              <p className="text-sm text-cream/70">
                {data.season ? `${data.season.year} season control` : 'Awaiting active season'}
              </p>
            </div>
          </div>
          <button
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3.5 py-2 text-sm font-medium text-cream transition-colors hover:bg-gold/20 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing' : 'Refresh Data'}
          </button>
        </div>
      </section>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-700" />
            <p className="text-sm text-amber-700">{error}</p>
          </div>
          <button
            onClick={() => loadDashboard()}
            className="text-left text-sm font-medium text-amber-700 transition-colors hover:text-ink sm:ml-auto"
          >
            Retry
          </button>
        </motion.div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-ink-soft">Loading dashboard data...</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LedgerStatCard
              icon={Users}
              label="Members"
              value={data.totalMembers}
              detail={enrolledCount > 0 ? `${enrolledCount} enrolled this season` : 'No enrollment yet'}
              index={0}
            />
            <LedgerStatCard
              icon={ShieldCheck}
              label="Confirmed"
              value={data.confirmed}
              detail={`${confirmedPercent}% of enrolled members`}
              index={1}
            />
            <LedgerStatCard
              icon={DollarSign}
              label="Dues Collected"
              value={`${data.duesProgress.percent}%`}
              detail={
                data.duesProgress.expected > 0
                  ? `${formatCurrency(data.duesProgress.collected)} of ${formatCurrency(data.duesProgress.expected)}`
                  : 'No dues data yet'
              }
              index={2}
            />
            <LedgerStatCard
              icon={FileText}
              label="Pending Applications"
              value={data.pendingApplications}
              detail={data.pendingApplications > 0 ? 'Awaiting lead review' : 'Queue clear'}
              index={3}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="luxury-card overflow-hidden p-0">
              <div className="flex flex-col gap-2 border-b border-tan/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-caption">Operations Board</p>
                  <h2 className="text-display-thin text-xl text-ink">Live Work Queues</h2>
                </div>
                <Link
                  href="/admin/communications"
                  className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-gold transition-colors hover:text-ink"
                >
                  Action center
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="grid gap-px bg-tan/30 p-px sm:grid-cols-2 xl:grid-cols-4">
                {operations.map((operation) => (
                  <OperationCard key={operation.code} {...operation} />
                ))}
              </div>
            </section>

            <aside className="luxury-card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-tan/30 px-4 py-3">
                <div>
                  <p className="text-caption">Alerts</p>
                  <h2 className="text-display-thin text-xl text-ink">Attention Rail</h2>
                </div>
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                  {alertCards.length}
                </span>
              </div>
              <div className="divide-y divide-tan/30">
                {alertCards.length > 0 ? (
                  alertCards.map(({ key: cardKey, ...card }) => (
                    <AlertRailCard key={cardKey} {...card} />
                  ))
                ) : (
                  <div className="p-4">
                    <div className="rounded-lg border border-sage/20 bg-sage/10 p-4">
                      <p className="text-sm font-medium text-ink">No active action alerts</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        Payment, ticketing, and application queues are currently clear.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>

          {/* Travel roll-up — same card as /admin/season; the dashboard is
              where admins actually look during arrival season */}
          <TravelSummaryCard />

          <section className="luxury-card overflow-hidden p-0">
            <div className="flex flex-col gap-2 border-b border-tan/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-caption">Member & Payment Ledger</p>
                <h2 className="text-display-thin text-xl text-ink">Recent Payments</h2>
              </div>
              {data.totalCollected > 0 && (
                <p className="text-sm text-ink-soft">
                  <span className="font-medium text-ink">{formatCurrency(data.totalCollected)}</span>
                  {' '}across {data.totalPayments} payment{data.totalPayments !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {data.recentPayments.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={TrendingUp}
                  title="No Payments Yet"
                  description="No payments have been recorded for the current season."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-sage/10 bg-cream/70">
                      <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                        Member
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
                        Method
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentPayments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-sage/10 transition-colors hover:bg-sage/[0.05]"
                      >
                        <td className="px-4 py-3 text-ink-soft">
                          {formatLedgerDate(payment.paidAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{payment.memberName}</p>
                          {payment.playaName && (
                            <p className="text-xs text-ink-soft">&ldquo;{payment.playaName}&rdquo;</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md border border-sage/20 bg-sage/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sage">
                            {payment.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium tabular-nums text-ink">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-ink-soft">
                          {payment.method}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <section className="luxury-card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-tan/30 px-4 py-3">
                <div>
                  <p className="text-caption">Roster</p>
                  <h2 className="text-display-thin text-xl text-ink">Status Breakdown</h2>
                </div>
                <Link
                  href="/admin/members"
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold transition-colors hover:text-ink"
                >
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-3.5 p-4">
                {statusBreakdown.map((item) => (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{item.label}</span>
                      <span className="tabular-nums text-ink-soft">{item.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-tan/20">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.count / maxCount) * 100}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        className={`h-full rounded-full ${statusBarColors[item.key]}`}
                      />
                    </div>
                  </div>
                ))}
                <div className="border-t border-tan/20 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">Total Enrolled</span>
                    <span className="font-semibold tabular-nums text-ink">{enrolledCount}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="luxury-card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-tan/30 px-4 py-3">
                <div>
                  <p className="text-caption">Intake</p>
                  <h2 className="text-display-thin text-xl text-ink">Recent Applications</h2>
                </div>
                <Link
                  href="/admin/applications"
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold transition-colors hover:text-ink"
                >
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {data.recentApplications.length === 0 ? (
                <div className="p-8 text-center">
                  <Clock className="mx-auto mb-3 h-8 w-8 text-ink-soft/30" />
                  <p className="text-sm text-ink-soft">No pending applications.</p>
                </div>
              ) : (
                <div className="divide-y divide-tan/30">
                  {data.recentApplications.map((app: RecentApplication) => (
                    <Link
                      key={app.id}
                      href="/admin/applications"
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-cream"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{app.name}</p>
                        <p className="truncate text-xs text-ink-soft">
                          {experienceLabels[app.experience] || app.experience}
                          {' / '}
                          {formatLedgerDate(app.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={app.status} variant="application" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="luxury-card overflow-hidden p-0">
              <div className="border-b border-tan/30 px-4 py-3">
                <p className="text-caption">Season</p>
                <h2 className="text-display-thin text-xl text-ink">Timeline</h2>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {timelinePhases.map((phase, phaseIdx) => {
                    const isCurrent = phase.key === currentPhase;
                    const isPast = currentPhaseIndex >= 0 && phaseIdx < currentPhaseIndex;

                    return (
                      <div key={phase.key} className="flex items-center gap-3">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                            isCurrent
                              ? 'border-gold/50 bg-gold/10 text-gold'
                              : isPast
                                ? 'border-sage/30 bg-sage/10 text-sage'
                                : 'border-tan/40 bg-cream text-ink-soft/50'
                          }`}
                        >
                          {isCurrent ? (
                            <Activity className="h-3.5 w-3.5" />
                          ) : isPast ? (
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          ) : (
                            <Calendar className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${isCurrent ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
                            {phase.label}
                          </p>
                        </div>
                        {isCurrent && (
                          <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold">
                            Active
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          <section className="luxury-card overflow-hidden p-0">
            <div className="border-b border-tan/30 px-4 py-3">
              <p className="text-caption">Shortcuts</p>
              <h2 className="text-display-thin text-xl text-ink">Quick Actions</h2>
            </div>
            <div className="grid gap-px bg-tan/30 p-px sm:grid-cols-2 xl:grid-cols-4">
              <QuickActionLink
                href="/admin/applications"
                icon={FileText}
                label="Review Applications"
                description={data.pendingApplications > 0 ? `${data.pendingApplications} pending` : 'Queue clear'}
                highlight={data.pendingApplications > 0}
              />
              <QuickActionLink
                href="/admin/members"
                icon={UserPlus}
                label="Manage Members"
                description={`${data.totalMembers} total members`}
              />
              <QuickActionLink
                href="/admin/season"
                icon={Calendar}
                label="Season Settings"
                description={data.season?.name || 'Configure season'}
              />
              <QuickActionLink
                href="/admin/communications"
                icon={Mail}
                label="Communications"
                description={
                  alertCards.length > 0
                    ? `${alertCards.length} active alert${alertCards.length !== 1 ? 's' : ''}`
                    : 'Email and action items'
                }
                highlight={alertCards.length > 0}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger helper components
// ---------------------------------------------------------------------------

function LedgerStatCard({
  icon: Icon,
  label,
  value,
  detail,
  index,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="luxury-card ledger-stat-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
            {label}
          </p>
          <p className="mt-3 text-display-thin text-3xl leading-none text-ink tabular-nums">
            {value}
          </p>
        </div>
        <div className="admin-icon-box h-10 w-10 shrink-0">
          <Icon className="h-5 w-5 text-gold" />
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-soft">{detail}</p>
    </motion.div>
  );
}

function OperationCard({
  code,
  label,
  count,
  detail,
  icon: Icon,
  href,
  action,
  progress,
  urgent = false,
}: {
  code: string;
  label: string;
  count: number;
  detail: string;
  icon: LucideIcon;
  href: string;
  action: string;
  progress?: number;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="admin-operation-card group min-h-[168px] p-4 transition-colors hover:bg-cream"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-tan/40 bg-cream px-1.5 text-[11px] font-medium text-ink-soft">
            {code}
          </span>
          <h3 className="mt-3 text-sm font-semibold text-ink">{label}</h3>
        </div>
        <Icon className="h-5 w-5 text-gold" />
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <p className="text-display-thin text-3xl leading-none text-ink tabular-nums">
          {count}
        </p>
        <span
          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] ${
            urgent
              ? 'border-gold/30 bg-gold/10 text-gold'
              : 'border-sage/20 bg-sage/10 text-sage'
          }`}
        >
          {action}
        </span>
      </div>
      <p className="mt-3 min-h-4 text-xs text-ink-soft">{detail}</p>
      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tan/30">
          <div
            className="h-full rounded-full bg-[#B88A45]"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
    </Link>
  );
}

function AlertRailCard({
  count,
  label,
  description,
  icon: Icon,
  href,
}: {
  count: number;
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="admin-rail-card group flex gap-3 px-4 py-3 transition-colors hover:bg-cream"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gold/30 bg-gold/10">
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <span className="tabular-nums text-ink-soft">{count}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-ink-soft">{description}</p>
      </div>
      <ArrowRight className="mt-2 h-3.5 w-3.5 shrink-0 text-ink-soft transition-colors group-hover:text-gold" />
    </Link>
  );
}

function QuickActionLink({
  href,
  icon: Icon,
  label,
  description,
  highlight = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="admin-quick-action group flex min-h-[96px] items-center justify-between p-4 transition-colors hover:bg-cream"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
            highlight
              ? 'border-gold/40 bg-gold/10'
              : 'border-sage/20 bg-sage/10'
          }`}
        >
          <Icon
            className={`h-4 w-4 ${highlight ? 'text-gold' : 'text-sage'}`}
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">{label}</p>
          <p className="text-xs text-ink-soft truncate">{description}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-ink-soft group-hover:text-gold transition-colors shrink-0 ml-2" />
    </Link>
  );
}
