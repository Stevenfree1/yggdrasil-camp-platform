'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Search,
  Mail,
  MailOpen,
  Eye,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  fetchEmailLog,
  fetchEmailLogStats,
  type EmailLogResult,
  type EmailLogStats,
  type EmailLogType,
  type EmailLogStatus,
} from '../../../lib/adminApi';

const TYPE_LABELS: Record<EmailLogType, string> = {
  WELCOME: 'Welcome',
  WELCOME_BACK: 'Welcome Back',
  PROFILE_SETUP: 'Profile Setup',
  APPLICATION_CONFIRMATION: 'Application Received',
  APPLICATION_APPROVED: 'Application Approved',
  APPLICATION_DENIED: 'Application Declined',
  PRE_APPROVAL_DUES: 'Pre-Approval Dues',
  PRE_APPROVAL_EXPIRED: 'Pre-Approval Expired',
  PASSWORD_RESET: 'Password Reset',
  INVITE: 'Invitation',
  MEMBERSHIP_REMINDER: 'Season Reminder',
  DUES_INCREASE_REMINDER: 'Dues Reminder',
  DONATION_RECEIPT: 'Donation Receipt',
  MASS_EMAIL: 'Mass Email',
  OTHER: 'Other',
};

const TYPE_OPTIONS = Object.entries(TYPE_LABELS) as [EmailLogType, string][];

const STATUS_OPTIONS: [EmailLogStatus, string][] = [
  ['SENT', 'Sent'],
  ['FAILED', 'Failed'],
  ['LOGGED_ONLY', 'Logged only'],
];

const PAGE_SIZE = 50;

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: EmailLogStatus }) {
  const map: Record<EmailLogStatus, { label: string; cls: string }> = {
    SENT: { label: 'Sent', cls: 'border-green-200 bg-green-50 text-green-700' },
    FAILED: { label: 'Failed', cls: 'border-red-200 bg-red-50 text-red-700' },
    LOGGED_ONLY: { label: 'Logged', cls: 'border-tan/40 bg-cream text-ink-soft' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function EmailLogPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<EmailLogType | ''>('');
  const [status, setStatus] = useState<EmailLogStatus | ''>('');
  const [openedOnly, setOpenedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<EmailLogResult | null>(null);
  const [stats, setStats] = useState<EmailLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the free-text search.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [type, status, openedOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, s] = await Promise.all([
        fetchEmailLog({
          search: search || undefined,
          type: type || undefined,
          status: status || undefined,
          openedOnly: openedOnly || undefined,
          page,
          limit: PAGE_SIZE,
        }),
        fetchEmailLogStats(),
      ]);
      setData(result);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email log');
    } finally {
      setLoading(false);
    }
  }, [search, type, status, openedOnly, page]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-display-thin text-3xl text-ink">Email Log</h1>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <p className="text-sm text-ink-soft">
              {stats.total} total · {stats.sent} sent · {stats.opened} opened
              {stats.failed > 0 && <span className="text-red-600"> · {stats.failed} failed</span>}
            </p>
          )}
          <Link
            href="/admin/emails/preview"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview templates
          </Link>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <p className="text-sm text-ink-soft -mt-2 max-w-2xl">
        Every transactional email the site sends is recorded here. Open tracking uses a 1×1 pixel,
        so opens are approximate — some clients (notably Apple Mail) pre-load images, and others block
        them entirely.
      </p>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft/50" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Recipient, subject, or name…"
            className="form-input pl-10"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as EmailLogType | '')}
          className="form-input w-auto"
          aria-label="Filter by email type"
        >
          <option value="">All types</option>
          {TYPE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EmailLogStatus | '')}
          className="form-input w-auto"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-ink-soft cursor-pointer select-none">
          <input
            type="checkbox"
            checked={openedOnly}
            onChange={(e) => setOpenedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-tan/50 text-sage focus:ring-sage"
          />
          Opened only
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
          <button
            onClick={load}
            className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="luxury-card p-0 overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-gold animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Mail className="h-8 w-8 text-ink-soft/40" />
            <p className="text-sm text-ink-soft">
              {search || type || status || openedOnly
                ? 'No emails match these filters.'
                : 'No emails have been sent yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/30 text-left text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                  <th className="px-4 py-3 font-semibold">Sent</th>
                  <th className="px-4 py-3 font-semibold">Recipient</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Opened</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-tan/20 last:border-0 align-top hover:bg-cream/60">
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft tabular-nums">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {row.member ? (
                        <Link
                          href={`/admin/members/${row.member.id}`}
                          className="font-medium text-ink hover:text-gold transition-colors"
                        >
                          {row.member.name}
                          <span className="block text-xs text-ink-soft font-normal">{row.to}</span>
                        </Link>
                      ) : (
                        <span className="text-ink">{row.to}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md border border-tan/40 bg-cream px-2 py-0.5 text-[11px] text-ink-soft whitespace-nowrap">
                        {TYPE_LABELS[row.type] ?? row.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink max-w-[22rem]">
                      <span className="line-clamp-2">{row.subject}</span>
                      {row.status === 'FAILED' && row.error && (
                        <span className="mt-1 block text-xs text-red-600 line-clamp-2">{row.error}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.openedAt ? (
                        <span className="inline-flex items-center gap-1.5 text-green-700">
                          <MailOpen className="h-4 w-4" />
                          <span className="text-xs">
                            {formatDateTime(row.openedAt)}
                            {row.openCount > 1 && (
                              <span className="text-ink-soft"> ·{row.openCount}×</span>
                            )}
                          </span>
                        </span>
                      ) : row.status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1.5 text-ink-soft/50">
                          <XCircle className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="text-ink-soft/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && pages > 1 && (
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>
            Page {data.page} of {pages} · {data.total} emails
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-tan/40 hover:bg-cream disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-tan/40 hover:bg-cream disabled:opacity-40 transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
