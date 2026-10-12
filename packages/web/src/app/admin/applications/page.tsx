'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  UserCheck,
  Send,
  Award,
  Users,
  ArrowRight,
} from 'lucide-react';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { EmptyState } from '../../../components/shared/EmptyState';
import {
  fetchApplications,
  fetchApplicationCounts,
  updateApplicationStatus,
  resendApplicationEmail,
  expireOverduePreApprovals,
  getApiErrorMessage,
  type Application,
  type ApplicationCounts,
  type ApplicationStatus,
} from '../../../lib/adminApi';

/**
 * Human label for the email an admin can re-send at each stage. Mirrors the
 * server's resendEmailKindFor(); null = no stage email (hide the button).
 */
function resendableEmailLabel(status: string): string | null {
  switch (status) {
    case 'SUBMITTED':
    case 'PENDING':
    case 'REVIEWED':
    case 'UNDER_REVIEW':
      return 'confirmation email';
    case 'PRE_APPROVED':
      return null; // pre-approval no longer carries a dues email (matches server resendEmailKindFor)
    case 'INVITED':
    case 'ACCEPTED':
      return 'approval email';
    case 'CONFIRMED':
      return 'welcome email';
    case 'DECLINED':
    case 'REJECTED':
      return 'decline email';
    default:
      return null;
  }
}

// Filter buckets group the 12+ statuses into something a human can scan.
type FilterBucket =
  | 'all'
  | 'inbox' // SUBMITTED + PENDING (the new + un-triaged ones)
  | 'in_review' // UNDER_REVIEW + REVIEWED
  | 'pre_approved' // PRE_APPROVED (now a fast-track tag, kept as a findable bucket)
  | 'approved' // APPROVED (decided, not yet invited)
  | 'invited' // INVITED — live end-state (member account created)
  | 'confirmed' // ACCEPTED + DUES_PAID + CONFIRMED (legacy, read-only)
  | 'waitlisted' // WAITLISTED
  | 'closed'; // DECLINED + REJECTED + WITHDRAWN

const filterBuckets: { id: FilterBucket; label: string; statuses: ApplicationStatus[] }[] = [
  { id: 'all',          label: 'All',          statuses: [] },
  { id: 'inbox',        label: 'Inbox',        statuses: ['SUBMITTED', 'PENDING'] },
  { id: 'in_review',    label: 'In Review',    statuses: ['UNDER_REVIEW', 'REVIEWED'] },
  { id: 'pre_approved', label: 'Pre-Approved', statuses: ['PRE_APPROVED'] },
  { id: 'approved',     label: 'Approved',     statuses: ['APPROVED'] },
  { id: 'invited',      label: 'Invited',      statuses: ['INVITED'] },
  // Legacy end-states (read-only); kept so old rows remain findable.
  { id: 'confirmed',    label: 'Confirmed',    statuses: ['ACCEPTED', 'DUES_PAID', 'CONFIRMED'] },
  { id: 'waitlisted',   label: 'Waitlisted',   statuses: ['WAITLISTED'] },
  { id: 'closed',       label: 'Closed',       statuses: ['DECLINED', 'REJECTED', 'WITHDRAWN'] },
];

type AppSortField = 'submitted' | 'name' | 'email' | 'experience' | 'status';

const experienceLabels: Record<string, string> = {
  FIRST_TIMER: 'First-timer',
  BEEN_BEFORE: 'Been before',
  VETERAN: 'Veteran',
};

/**
 * Available transitions from any given status — drives the action buttons in
 * the expanded detail panel. Order matters (left-to-right primary action first).
 *
 * The funnel is intentionally SHORT and ends at INVITED, which is the canonical
 * account-creation trigger (it bridges the application into a real member +
 * season-roster row). Everything after INVITED — dues collection, activation,
 * payments — now lives on the member's season record (the /admin/roster grid),
 * NOT on the application card. So this never advances an app into the legacy
 * ACCEPTED → DUES_PAID → CONFIRMED chain; those statuses only appear on old rows
 * and render read-only. PRE_APPROVED is now an optional fast-track TAG, not a
 * required step (it just stamps preApprovedAt; no dues email/clock).
 */
function nextActions(status: string): { target: ApplicationStatus; label: string; tone: 'primary' | 'sage' | 'gold' | 'danger' | 'neutral'; icon: React.ComponentType<{ className?: string }> }[] {
  switch (status) {
    case 'SUBMITTED':
    case 'PENDING':
      return [
        { target: 'UNDER_REVIEW', label: 'Start review',    tone: 'sage',    icon: UserCheck },
        { target: 'PRE_APPROVED', label: 'Pre-approve',     tone: 'neutral', icon: Award },
        { target: 'APPROVED',     label: 'Approve',         tone: 'sage',    icon: CheckCircle },
        { target: 'WAITLISTED',   label: 'Waitlist',        tone: 'gold',    icon: Clock },
        { target: 'DECLINED',     label: 'Decline',         tone: 'danger',  icon: XCircle },
      ];
    case 'UNDER_REVIEW':
    case 'REVIEWED':
      return [
        { target: 'APPROVED',     label: 'Approve',         tone: 'sage',    icon: CheckCircle },
        { target: 'PRE_APPROVED', label: 'Pre-approve',     tone: 'neutral', icon: Award },
        { target: 'WAITLISTED',   label: 'Waitlist',        tone: 'gold',    icon: Clock },
        { target: 'DECLINED',     label: 'Decline',         tone: 'danger',  icon: XCircle },
      ];
    case 'PRE_APPROVED':
      // Pre-approved is now a TAG, not a dues step. From here you still Approve
      // and/or Send invitation; no dues stage in between.
      return [
        { target: 'APPROVED',     label: 'Approve',         tone: 'sage',    icon: CheckCircle },
        { target: 'INVITED',      label: 'Send invitation', tone: 'sage',    icon: Send },
        { target: 'WAITLISTED',   label: 'Waitlist',        tone: 'gold',    icon: Clock },
        { target: 'DECLINED',     label: 'Decline',         tone: 'danger',  icon: XCircle },
      ];
    case 'APPROVED':
      return [
        { target: 'INVITED',      label: 'Send invitation', tone: 'sage',    icon: Send },
        { target: 'WAITLISTED',   label: 'Waitlist',        tone: 'gold',    icon: Clock },
        { target: 'DECLINED',     label: 'Decline',         tone: 'danger',  icon: XCircle },
      ];
    case 'INVITED':
      // Terminal for the funnel: the member account/roster row now exists, so
      // dues + activation are managed on the member's season record, not here.
      // Only "Withdrew" remains (e.g. they backed out before activating).
      return [
        { target: 'WITHDRAWN',    label: 'Withdrew',        tone: 'neutral', icon: XCircle },
      ];
    case 'WAITLISTED':
      return [
        { target: 'APPROVED',     label: 'Approve',         tone: 'sage',    icon: CheckCircle },
        { target: 'PRE_APPROVED', label: 'Pre-approve',     tone: 'neutral', icon: Award },
        { target: 'DECLINED',     label: 'Decline',         tone: 'danger',  icon: XCircle },
      ];
    default:
      // ACCEPTED, DUES_PAID, CONFIRMED — legacy end-states (read-only, the
      // dues/confirm buttons moved to the member record). DECLINED, REJECTED,
      // WITHDRAWN — terminal. No further forward actions.
      return [];
  }
}

const toneClasses: Record<string, string> = {
  primary: 'bg-sage text-white hover:bg-sage/90',
  sage:    'bg-sage text-white hover:bg-sage/90',
  gold:    'bg-gold text-white hover:bg-gold/90',
  danger:  'bg-ink-soft text-white hover:bg-ink',
  neutral: 'bg-white border border-tan/40 text-ink-soft hover:bg-cream',
};

/**
 * Statuses that mean "this application has become a real member + season-roster
 * row." INVITED is the canonical (new-funnel) trigger; ACCEPTED/DUES_PAID/
 * CONFIRMED are legacy end-states that also bridged a member. For all of these
 * the card shows a "✓ Member" chip + link to the member record instead of
 * dues/confirm buttons (which moved to the roster grid).
 */
const MEMBER_STATES = ['INVITED', 'ACCEPTED', 'DUES_PAID', 'CONFIRMED'];

/** True when the application carries the optional Pre-Approved fast-track tag. */
function isPreApproved(app: { status: string; preApprovedAt?: string | null }): boolean {
  return app.status === 'PRE_APPROVED' || !!app.preApprovedAt;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState<ApplicationCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterBucket>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [transitionLoading, setTransitionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<AppSortField>('submitted');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const selectedBucket = useMemo(
    () => filterBuckets.find((b) => b.id === filter) ?? filterBuckets[0],
    [filter],
  );

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [appResult, countResult] = await Promise.all([
        fetchApplications({
          statuses: selectedBucket.statuses.length > 0 ? selectedBucket.statuses : undefined,
          limit: 200,
          offset: 0,
        }),
        fetchApplicationCounts(),
      ]);
      setApplications(appResult.applications);
      setTotalCount(appResult.total);
      setCounts(countResult);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('Unable to load applications. The server may not be running.');
      setApplications([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [selectedBucket]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleTransition = async (applicationId: string, target: ApplicationStatus, targetLabel: string) => {
    try {
      setTransitionLoading(applicationId);
      const updated = await updateApplicationStatus(applicationId, target, reviewNotes[applicationId]);

      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId
            ? { ...app, ...updated }
            : app,
        ),
      );

      showNotification(`Application → ${targetLabel}.`, 'success');
      // Refresh counts in background
      fetchApplicationCounts().then(setCounts).catch(() => null);
    } catch (e) {
      console.error(e);
      showNotification('Failed to update status. Please try again.', 'error');
    } finally {
      setTransitionLoading(null);
    }
  };

  const [resendLoading, setResendLoading] = useState<string | null>(null);
  const handleResend = async (applicationId: string) => {
    try {
      setResendLoading(applicationId);
      const result = await resendApplicationEmail(applicationId);
      showNotification(`Email re-sent to ${result.email}.`, 'success');
    } catch (e) {
      console.error(e);
      showNotification(getApiErrorMessage(e) || 'Failed to resend email. Please try again.', 'error');
    } finally {
      setResendLoading(null);
    }
  };

  const [sweeping, setSweeping] = useState(false);
  const handleDuesSweep = async () => {
    try {
      setSweeping(true);
      const result = await expireOverduePreApprovals(false);
      if (result.expired === 0) {
        showNotification('No overdue pre-approvals — everyone is within their dues window.', 'success');
      } else {
        showNotification(`Moved ${result.expired} overdue pre-approval${result.expired === 1 ? '' : 's'} to waitlist (emailed).`, 'success');
        loadAll();
      }
    } catch (e) {
      console.error(e);
      showNotification('Dues sweep failed. Please try again.', 'error');
    } finally {
      setSweeping(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filtered = applications.filter((a) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.name.toLowerCase().includes(term) ||
      a.email.toLowerCase().includes(term) ||
      (a.playaName && a.playaName.toLowerCase().includes(term)) ||
      (a.referredBy && a.referredBy.toLowerCase().includes(term))
    );
  });

  const handleSort = (field: AppSortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // Dates read best newest-first; text columns A→Z.
      setSortDir(field === 'submitted' ? 'desc' : 'asc');
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'submitted': {
        const aT = new Date(a.submittedAt || a.createdAt).getTime();
        const bT = new Date(b.submittedAt || b.createdAt).getTime();
        cmp = aT - bT;
        break;
      }
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'email':
        cmp = a.email.localeCompare(b.email);
        break;
      case 'experience':
        cmp = (a.experience || '').localeCompare(b.experience || '');
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: AppSortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 inline ml-1" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 inline ml-1" />
    );
  };

  const inboxCount = counts ? counts.SUBMITTED + counts.PENDING : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-display-thin text-3xl text-ink">Applications</h1>
          {inboxCount > 0 && (
            <span className="admin-chip" data-tone="urgent">
              {inboxCount} in inbox
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-ink-soft">
            {totalCount} matching · {counts?.total ?? 0} total
          </p>
          <button
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Capacity tracker (only if a season has capacity set) */}
      {counts?.capacity && counts.capacity.capacity != null && (
        <div className="rounded-xl border border-tan/30 bg-cream px-4 py-3 flex items-center gap-3 text-sm">
          <Users className="h-4 w-4 text-sage shrink-0" />
          <span className="text-ink">
            <strong>{counts.capacity.confirmedCount}</strong> confirmed of <strong>{counts.capacity.capacity}</strong> capacity
            {counts.capacity.remaining != null && (
              <span className="text-ink-soft"> · {counts.capacity.remaining} remaining</span>
            )}
          </span>
        </div>
      )}

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-3 ${
              notification.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {notification.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 shrink-0" />
            )}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar: Filter pills + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-wrap gap-2">
          {filterBuckets.map((btn) => {
            const n = btn.statuses.length === 0
              ? counts?.total ?? 0
              : btn.statuses.reduce((sum, s) => sum + (counts?.[s] ?? 0), 0);
            return (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  filter === btn.id
                    ? 'bg-sage text-white'
                    : 'bg-white border border-tan/40 text-ink-soft hover:bg-cream'
                }`}
              >
                {btn.label}
                <span className={`text-[10px] tabular-nums ${filter === btn.id ? 'text-white/80' : 'text-ink-soft/60'}`}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft/50" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Name, email, or sponsor..."
            className="form-input pl-10"
          />
        </div>
        <button
          onClick={handleDuesSweep}
          disabled={sweeping}
          title="Move pre-approved applicants past their dues deadline to the waitlist (and email them)"
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-tan/40 bg-white text-ink-soft hover:bg-cream transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {sweeping ? 'Running…' : 'Run dues sweep'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
          <button
            onClick={loadAll}
            className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Loading applications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Applications"
          description={
            searchTerm
              ? `No applications match "${searchTerm}".`
              : filter !== 'all'
                ? `No applications in this bucket.`
                : 'No applications have been submitted yet.'
          }
          action={
            filter !== 'all' || searchTerm
              ? {
                  label: 'Clear Filters',
                  onClick: () => {
                    setFilter('all');
                    setSearchTerm('');
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Table Header (click to sort) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-ink-soft uppercase tracking-wider">
            <button onClick={() => handleSort('submitted')} className="col-span-2 text-left uppercase tracking-wider cursor-pointer hover:text-ink select-none">
              Submitted <SortIcon field="submitted" />
            </button>
            <button onClick={() => handleSort('name')} className="col-span-3 text-left uppercase tracking-wider cursor-pointer hover:text-ink select-none">
              Name / Sponsor <SortIcon field="name" />
            </button>
            <button onClick={() => handleSort('email')} className="col-span-3 text-left uppercase tracking-wider cursor-pointer hover:text-ink select-none">
              Email <SortIcon field="email" />
            </button>
            <button onClick={() => handleSort('experience')} className="col-span-2 text-left uppercase tracking-wider cursor-pointer hover:text-ink select-none">
              Profile <SortIcon field="experience" />
            </button>
            <button onClick={() => handleSort('status')} className="col-span-2 text-left uppercase tracking-wider cursor-pointer hover:text-ink select-none">
              Status <SortIcon field="status" />
            </button>
          </div>

          {sorted.map((app, idx) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx, 12) * 0.02, duration: 0.25 }}
              className="luxury-card p-0 overflow-hidden"
            >
              {/* Row */}
              <button
                onClick={() => toggleExpand(app.id)}
                className="w-full text-left grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center px-4 py-3 hover:bg-sage/[0.03] transition-colors"
              >
                <div className="col-span-2 text-sm text-ink-soft">
                  {new Date(app.submittedAt || app.createdAt).toLocaleDateString()}
                </div>
                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{app.name}</p>
                  <p className="text-xs text-ink-soft truncate">
                    {app.sponsorMember ? (
                      <span className="text-sage">↳ {app.sponsorMember.name}</span>
                    ) : app.referredBy ? (
                      <span className="text-ink-soft/70">↳ {app.referredBy}</span>
                    ) : (
                      <span className="text-ink-soft/40">no sponsor</span>
                    )}
                  </p>
                </div>
                <div className="col-span-3 text-sm text-ink-soft truncate">
                  {app.email}
                </div>
                <div className="col-span-2 text-xs text-ink-soft flex flex-wrap gap-1.5">
                  {isPreApproved(app) && <ProfileTag>Pre-Approved</ProfileTag>}
                  {app.isBurningManFirstTime && <ProfileTag>BM Virgin</ProfileTag>}
                  {app.isCampReturning && <ProfileTag>Returning</ProfileTag>}
                  {app.hasTicket === false && <ProfileTag tone="warn">No ticket</ProfileTag>}
                </div>
                <div className="col-span-2 flex items-center justify-between gap-2">
                  <StatusBadge status={app.status} variant="application" />
                  {expandedId === app.id ? (
                    <ChevronUp className="h-4 w-4 text-ink-soft shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-ink-soft shrink-0" />
                  )}
                </div>
              </button>

              {/* Expanded Detail */}
              <AnimatePresence>
                {expandedId === app.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-tan/30 px-4 py-5 space-y-5">
                      {/* Identity / contact */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <DetailField label="Phone" value={app.phone} />
                        <DetailField label="Playa Name" value={app.playaName} />
                        <DetailField label="Experience" value={experienceLabels[app.experience] || app.experience} />
                        <DetailField
                          label="Sponsor"
                          value={app.sponsorMember ? `${app.sponsorMember.name}` : (app.referredBy ?? null)}
                          tone={app.sponsorMember ? 'sage' : (app.referredBy ? 'ink-soft' : undefined)}
                        />
                        <DetailField label="Household" value={app.household?.name ?? null} />
                        <DetailField label="Season" value={app.season ? `${app.season.year} (${app.season.name})` : null} />
                        <DetailField label="Source" value={app.source ?? null} />
                        <DetailField label="Submitted" value={app.submittedAt ? new Date(app.submittedAt).toLocaleString() : null} />
                        {app.reviewedAt && (
                          <DetailField label="Reviewed" value={`${new Date(app.reviewedAt).toLocaleString()}${app.reviewedByMember ? ' by ' + app.reviewedByMember.name : ''}`} />
                        )}
                      </div>

                      {/* Form booleans */}
                      <div className="flex flex-wrap gap-2">
                        {app.isBurningManFirstTime !== null && app.isBurningManFirstTime !== undefined && (
                          <ProfileTag>{app.isBurningManFirstTime ? "First-time burner" : "Veteran burner"}</ProfileTag>
                        )}
                        {app.isCampReturning !== null && app.isCampReturning !== undefined && (
                          <ProfileTag>{app.isCampReturning ? "Returning camper" : "New to camp"}</ProfileTag>
                        )}
                        {app.hasTicket !== null && app.hasTicket !== undefined && (
                          <ProfileTag tone={app.hasTicket ? undefined : 'warn'}>
                            {app.hasTicket ? "Has ticket" : "No ticket yet"}
                          </ProfileTag>
                        )}
                        {app.strikeCommitment !== null && app.strikeCommitment !== undefined && (
                          <ProfileTag tone={app.strikeCommitment ? undefined : 'warn'}>
                            {app.strikeCommitment ? "Strike: yes" : "Strike: no"}
                          </ProfileTag>
                        )}
                      </div>

                      {/* Long-form responses */}
                      {app.motivationText && (
                        <DetailField label="What the camp means to them" value={app.motivationText} fullWidth />
                      )}
                      {app.contribution && (
                        <DetailField label="Contribution / involvement" value={app.contribution} fullWidth />
                      )}
                      {app.housingPreference && (
                        <DetailField label="Accommodation" value={app.housingPreference} fullWidth />
                      )}
                      {app.groupMembersText && (
                        <DetailField label="Group members (raw)" value={app.groupMembersText} fullWidth />
                      )}
                      {app.message && (
                        <DetailField label="Message" value={app.message} fullWidth />
                      )}

                      {/* Existing review notes */}
                      {app.reviewNotes && (
                        <div className="rounded-xl bg-cream border border-tan/20 p-4">
                          <p className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-1">
                            Review Notes
                          </p>
                          <p className="text-sm text-ink whitespace-pre-wrap">{app.reviewNotes}</p>
                        </div>
                      )}

                      {/* Transition actions */}
                      <TransitionActions
                        app={app}
                        reviewNotes={reviewNotes}
                        setReviewNotes={setReviewNotes}
                        transitionLoading={transitionLoading}
                        onTransition={handleTransition}
                        resendLoading={resendLoading}
                        onResend={handleResend}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileTag({ children, tone }: { children: React.ReactNode; tone?: 'warn' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
        tone === 'warn'
          ? 'bg-gold/10 text-gold border-gold/20'
          : 'bg-sage/10 text-sage border-sage/20'
      }`}
    >
      {children}
    </span>
  );
}

function TransitionActions({
  app,
  reviewNotes,
  setReviewNotes,
  transitionLoading,
  onTransition,
  resendLoading,
  onResend,
}: {
  app: Application;
  reviewNotes: Record<string, string>;
  setReviewNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  transitionLoading: string | null;
  onTransition: (id: string, target: ApplicationStatus, label: string) => void;
  resendLoading: string | null;
  onResend: (id: string) => void;
}) {
  const actions = nextActions(app.status);
  const resendLabel = resendableEmailLabel(app.status);
  const resendButton = resendLabel ? (
    <button
      onClick={() => onResend(app.id)}
      disabled={resendLoading === app.id}
      title={`Re-send the ${resendLabel} to ${app.email}`}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
    >
      {resendLoading === app.id ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      Resend {resendLabel}
    </button>
  ) : null;

  // Once an application reaches INVITED (or a legacy member end-state), it has a
  // real member + season-roster row. Dues/activation/payments are managed there
  // (the roster grid), NOT on this card — so surface a link to the member record
  // instead of dues/confirm buttons. The application row doesn't carry memberId,
  // so we link by email to the roster grid's search.
  const isMember = MEMBER_STATES.includes(app.status);
  const memberRecordBlock = isMember ? (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <CheckCircle className="h-3.5 w-3.5" />
        Member
      </span>
      <Link
        href={`/admin/members?search=${encodeURIComponent(app.email)}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-sage hover:text-sage/80 transition-colors"
      >
        Open member record
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  ) : null;

  if (actions.length === 0) {
    return (
      <div className="border-t border-tan/30 pt-4 space-y-3">
        {memberRecordBlock ?? (
          <p className="text-xs text-ink-soft">Terminal status — no further actions available.</p>
        )}
        {resendButton && <div className="flex flex-wrap gap-3">{resendButton}</div>}
      </div>
    );
  }

  return (
    <div className="border-t border-tan/30 pt-5 space-y-4">
      {memberRecordBlock}
      <div>
        <label className="form-label">Review note (optional, attached to next transition)</label>
        <textarea
          value={reviewNotes[app.id] || ''}
          onChange={(e) =>
            setReviewNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
          }
          rows={2}
          className="form-input"
          placeholder="e.g. 'returning member, paid dues in full, pre-approved by a lead'"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.target}
              onClick={() => onTransition(app.id, a.target, a.label)}
              disabled={transitionLoading === app.id}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${toneClasses[a.tone]}`}
            >
              {transitionLoading === app.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {a.label}
            </button>
          );
        })}
        {resendButton}
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  fullWidth = false,
  tone,
}: {
  label: string;
  value?: string | null;
  fullWidth?: boolean;
  tone?: 'sage' | 'ink-soft';
}) {
  if (!value) return null;
  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <p className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className={`text-sm whitespace-pre-wrap ${tone === 'sage' ? 'text-sage' : tone === 'ink-soft' ? 'text-ink-soft' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  );
}
