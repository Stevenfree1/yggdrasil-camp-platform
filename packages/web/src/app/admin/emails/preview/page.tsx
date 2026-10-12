'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import {
  fetchEmailPreviews,
  type EmailPreview,
  type EmailLogType,
} from '../../../../lib/adminApi';

const TYPE_LABELS: Record<EmailLogType, string> = {
  WELCOME: 'Welcome (dues confirmed)',
  WELCOME_BACK: 'Welcome Back (returning member)',
  PROFILE_SETUP: 'Set Up Your Account',
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

export default function EmailPreviewPage() {
  const [previews, setPreviews] = useState<EmailPreview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPreviews(await fetchEmailPreviews());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email previews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/emails"
            className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-gold transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Email Log
          </Link>
          <h1 className="text-display-thin text-3xl text-ink mt-1">Email Templates</h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors self-start"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <p className="text-sm text-ink-soft -mt-2 max-w-2xl">
        Every transactional email the site sends, rendered with sample data (recipient &ldquo;Jane Doe&rdquo;).
        These are produced by the live templates, so what you see here is exactly what goes out. To change
        wording, ask a developer &mdash; the copy lives in code.
      </p>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
          <button onClick={load} className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900">
            Retry
          </button>
        </div>
      )}

      {loading && !previews ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-gold animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {previews?.map((p, i) => (
            <div key={`${p.type}-${i}`} className="luxury-card p-0 overflow-hidden flex flex-col">
              <div className="border-b border-tan/30 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-gold font-semibold">
                  {TYPE_LABELS[p.type] ?? p.type}
                </p>
                <p className="text-sm text-ink mt-0.5 truncate" title={p.subject}>
                  {p.subject}
                </p>
              </div>
              <iframe
                srcDoc={p.html}
                sandbox=""
                title={`${TYPE_LABELS[p.type] ?? p.type} email preview`}
                loading="lazy"
                className="w-full h-[680px] bg-white border-0"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
