'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  AlertCircle,
  Loader2,
  RefreshCw,
  DollarSign,
  Ticket,
  MessageSquare,
  FileCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  Send,
  Copy,
  Check,
  List,
  ArrowRight,
  Users,
  Clipboard,
  Megaphone,
  LayoutTemplate,
  Eye,
} from 'lucide-react';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { AnnouncementsTab } from './AnnouncementsTab';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';
import {
  fetchActionItems,
  sendMassEmail,
  generateEmailList,
  fetchMassEmailTemplates,
  type ActionItems,
  type ActionItemMember,
  type SendMassEmailResult,
  type EmailListResult,
  type MassEmailTemplate,
} from '../../../lib/adminApi';

// Client-side mirror of the server merge renderer, for the composer preview only.
function applyMergePreview(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, key: string) => ctx[key] ?? '');
}

// Sample values so the admin sees resolved text before sending.
const SAMPLE_MERGE_CONTEXT: Record<string, string> = {
  firstName: 'Jane',
  seasonName: 'the upcoming season',
  duesAmount: '$1,200',
};

// ---------------------------------------------------------------------------
// Filter options shared between Mass Email and Email List sections
// ---------------------------------------------------------------------------

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Members' },
  { value: 'confirmed', label: 'Confirmed Members' },
  { value: 'unpaid_dues', label: 'Unpaid Dues' },
  { value: 'build_crew', label: 'Build Crew' },
  { value: 'strike_crew', label: 'Strike Crew' },
  { value: 'not_on_whatsapp', label: 'Not on WhatsApp' },
  { value: 'no_preapproval', label: 'No Pre-Approval Form' },
  { value: 'no_ticket', label: 'No Ticket' },
  { value: 'no_travel_plans', label: 'No Travel Plans' },
  { value: 'custom', label: 'Custom Email List' },
];

// ---------------------------------------------------------------------------
// Action Item Card definitions
// ---------------------------------------------------------------------------

interface ActionCardDef {
  key: keyof Omit<ActionItems, 'pendingApplications'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  emailFilter: string;
}

const ACTION_CARDS: ActionCardDef[] = [
  { key: 'unpaidDues', label: 'Unpaid Dues', icon: DollarSign, emailFilter: 'unpaid_dues' },
  { key: 'noTicket', label: 'No Ticket', icon: Ticket, emailFilter: 'no_ticket' },
  { key: 'notOnWhatsApp', label: 'Not on WhatsApp', icon: MessageSquare, emailFilter: 'not_on_whatsapp' },
  { key: 'noPreApproval', label: 'No Pre-Approval Form', icon: FileCheck, emailFilter: 'no_preapproval' },
];

// ---------------------------------------------------------------------------
// Quick Email List definitions
// ---------------------------------------------------------------------------

interface QuickListDef {
  label: string;
  filter: string;
  icon: React.ComponentType<{ className?: string }>;
}

const QUICK_LISTS: QuickListDef[] = [
  { label: 'All Members', filter: 'all', icon: Users },
  { label: 'Unpaid Dues', filter: 'unpaid_dues', icon: DollarSign },
  { label: 'No Ticket', filter: 'no_ticket', icon: Ticket },
  { label: 'Not on WhatsApp', filter: 'not_on_whatsapp', icon: MessageSquare },
  { label: 'No Pre-Approval', filter: 'no_preapproval', icon: FileCheck },
  { label: 'Build Crew', filter: 'build_crew', icon: Users },
  { label: 'Strike Crew', filter: 'strike_crew', icon: Users },
];

// ---------------------------------------------------------------------------
// Placeholder
// ---------------------------------------------------------------------------

const placeholderActionItems: ActionItems = {
  unpaidDues: { count: 0, members: [] },
  noTicket: { count: 0, members: [] },
  notOnWhatsApp: { count: 0, members: [] },
  noPreApproval: { count: 0, members: [] },
  pendingApplications: { count: 0 },
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

type CommsTab = 'email' | 'announcements' | 'templates';

export default function CommunicationsPage() {
  const { selectedSeasonId } = useAdminSeason();

  // Top-level tab (Email tools vs Announcements management)
  const [activeTab, setActiveTab] = useState<CommsTab>('email');

  // Action Items state
  const [actionItems, setActionItems] = useState<ActionItems>(placeholderActionItems);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Mass Email state
  const [emailFilter, setEmailFilter] = useState('all');
  const [customEmails, setCustomEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [emailResult, setEmailResult] = useState<SendMassEmailResult | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<MassEmailTemplate[]>([]);
  const [templateKey, setTemplateKey] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Email List state
  const [listFilter, setListFilter] = useState('all');
  const [listCustomEmails, setListCustomEmails] = useState('');
  const [generatingList, setGeneratingList] = useState(false);
  const [emailList, setEmailList] = useState<EmailListResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Quick Email List state
  const [quickListLoading, setQuickListLoading] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load action items
  // ---------------------------------------------------------------------------

  const loadActionItems = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchActionItems(selectedSeasonId || undefined);
      setActionItems(result);
      setError(null);
    } catch {
      setError('Unable to load action items. The server may not be running.');
    } finally {
      setLoading(false);
    }
  }, [selectedSeasonId]);

  useEffect(() => {
    loadActionItems();
  }, [loadActionItems]);

  // ---------------------------------------------------------------------------
  // Fetch preview count when email filter changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (emailFilter === 'custom') {
      const lines = customEmails
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      setPreviewCount(lines.length);
      return;
    }

    // For known action item filters, use the local count for immediate feedback
    const localCountMap: Record<string, number | undefined> = {
      unpaid_dues: actionItems.unpaidDues.count,
      no_ticket: actionItems.noTicket.count,
      not_on_whatsapp: actionItems.notOnWhatsApp.count,
      no_preapproval: actionItems.noPreApproval.count,
    };

    if (localCountMap[emailFilter] !== undefined) {
      setPreviewCount(localCountMap[emailFilter]!);
      return;
    }

    // For filters we don't have local counts for, fetch from the server
    if (!selectedSeasonId) {
      setPreviewCount(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

    generateEmailList({
      seasonId: selectedSeasonId,
      filter: emailFilter,
    })
      .then((result) => {
        if (!cancelled) {
          setPreviewCount(result.count);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewCount(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [emailFilter, customEmails, actionItems, selectedSeasonId]);

  // ---------------------------------------------------------------------------
  // Send mass email
  // ---------------------------------------------------------------------------

  const handleSendEmail = async () => {
    try {
      setSendingEmail(true);
      setEmailResult(null);
      const result = await sendMassEmail({
        seasonId: selectedSeasonId || undefined,
        recipientFilter: emailFilter,
        customEmails:
          emailFilter === 'custom'
            ? customEmails
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
            : undefined,
        subject,
        body,
        templateKey: templateKey || undefined,
      });
      setEmailResult(result);
    } catch {
      setEmailResult({ sent: 0, failed: 1, errors: ['Failed to send email. Please try again.'] });
    } finally {
      setSendingEmail(false);
    }
  };

  // Load the broadcast template registry once.
  useEffect(() => {
    fetchMassEmailTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  // Prefill the editable subject/body from a template and jump to the composer.
  const applyTemplate = (t: MassEmailTemplate) => {
    setTemplateKey(t.key);
    setSubject(t.subject);
    setBody(t.body);
    setEmailResult(null);
    setShowPreview(true);
    setActiveTab('email');
  };

  // ---------------------------------------------------------------------------
  // Generate email list
  // ---------------------------------------------------------------------------

  const handleGenerateList = async () => {
    try {
      setGeneratingList(true);
      setEmailList(null);
      const result = await generateEmailList({
        seasonId: selectedSeasonId || undefined,
        filter: listFilter,
        customEmails:
          listFilter === 'custom'
            ? listCustomEmails
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
            : undefined,
      });
      setEmailList(result);
    } catch {
      setEmailList({ emails: [], count: 0 });
    } finally {
      setGeneratingList(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Quick email list -- one-click copy for common segments
  // ---------------------------------------------------------------------------

  const handleQuickCopy = async (filter: string) => {
    try {
      setQuickListLoading(filter);
      const result = await generateEmailList({
        seasonId: selectedSeasonId || undefined,
        filter,
      });
      const emailText = result.emails.map((e) => e.email).join(', ');
      await navigator.clipboard.writeText(emailText);
      setCopied(`quick-${filter}`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard or API unavailable
    } finally {
      setQuickListLoading(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Copy from action item cards
  // ---------------------------------------------------------------------------

  const handleCopyActionEmails = async (members: ActionItemMember[]) => {
    const emailText = members.map((m) => m.email).join(', ');
    try {
      await navigator.clipboard.writeText(emailText);
      setCopied('action-emails');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  // ---------------------------------------------------------------------------
  // Clipboard
  // ---------------------------------------------------------------------------

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  // ---------------------------------------------------------------------------
  // Compose email from action item card
  // ---------------------------------------------------------------------------

  const handleComposeFromCard = (card: ActionCardDef) => {
    setEmailFilter(card.emailFilter);
    setEmailResult(null);
    // Scroll to compose section
    const composeSection = document.getElementById('compose-email');
    if (composeSection) {
      composeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display-thin text-3xl text-ink">Communications</h1>
          <p className="text-body-relaxed text-sm text-ink-soft mt-1">
            Action items, mass email, email lists, and announcements
          </p>
        </div>
        {activeTab === 'email' && (
          <button
            onClick={() => loadActionItems()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-tan/30">
        {([
          { id: 'email' as const, label: 'Email', icon: Mail },
          { id: 'templates' as const, label: 'Templates', icon: LayoutTemplate },
          { id: 'announcements' as const, label: 'Announcements', icon: Megaphone },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === id
                ? 'border-sage text-sage'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'announcements' && <AnnouncementsTab />}

      {/* Templates tab — the findable home for broadcast templates. */}
      {activeTab === 'templates' && (
        <section className="luxury-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/5 border border-sage/10">
              <LayoutTemplate className="h-5 w-5 text-sage" />
            </div>
            <div>
              <h2 className="text-display-thin text-xl text-ink">Email Templates</h2>
              <p className="text-xs text-ink-soft">
                Personalized starting points — each is sent with the recipient&rsquo;s own name filled in.
              </p>
            </div>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-ink-soft">No templates available.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {templates.map((t) => (
                <div key={t.key} className="frame-panel p-4 flex flex-col gap-3">
                  <div>
                    <h3 className="text-base font-medium text-ink">{t.label}</h3>
                    {t.description && <p className="text-xs text-ink-soft mt-0.5">{t.description}</p>}
                  </div>
                  <div className="rounded-lg border border-tan/30 bg-cream/50 p-3 text-xs text-ink-soft">
                    <p className="font-medium text-ink mb-1">{applyMergePreview(t.subject, SAMPLE_MERGE_CONTEXT)}</p>
                    <p className="whitespace-pre-line line-clamp-4">{applyMergePreview(t.body, SAMPLE_MERGE_CONTEXT)}</p>
                  </div>
                  {t.variables.length > 0 && (
                    <p className="text-[11px] text-ink-soft">
                      Fields: {t.variables.map((v) => `{{${v}}}`).join(', ')}
                    </p>
                  )}
                  <button
                    onClick={() => applyTemplate(t)}
                    className="cta-secondary text-sm px-4 py-2 flex items-center gap-2 self-start"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Use this template
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Error Banner */}
      {activeTab === 'email' && error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
          <button
            onClick={() => loadActionItems()}
            className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      {activeTab === 'email' && loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Loading action items...</p>
        </div>
      )}

      {activeTab === 'email' && !loading && (
        <>
          {/* ================================================================= */}
          {/* ACTION ITEMS SECTION                                              */}
          {/* ================================================================= */}
          <section>
            <h2 className="text-display-thin text-xl text-ink mb-4">Action Items</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Standard action cards */}
              {ACTION_CARDS.map((card) => {
                const data = actionItems[card.key];
                const isExpanded = expandedCard === card.key;
                const Icon = card.icon;
                const hasItems = data.count > 0;

                return (
                  <motion.div
                    key={card.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`luxury-card overflow-hidden ${
                      hasItems ? 'border-amber-200' : ''
                    }`}
                  >
                    <button
                      onClick={() => setExpandedCard(isExpanded ? null : card.key)}
                      className="w-full p-5 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            hasItems
                              ? 'bg-amber-50 border border-amber-200'
                              : 'bg-sage/5 border border-sage/10'
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              hasItems ? 'text-amber-600' : 'text-sage'
                            }`}
                          />
                        </div>
                        <div>
                          <p
                            className={`text-2xl font-semibold tabular-nums ${
                              hasItems ? 'text-amber-700' : 'text-ink'
                            }`}
                          >
                            {data.count}
                          </p>
                          <p className="text-sm text-ink-soft">{card.label}</p>
                        </div>
                      </div>
                      {hasItems && (
                        isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-ink-soft" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-ink-soft" />
                        )
                      )}
                    </button>

                    {/* Expandable member list */}
                    <AnimatePresence>
                      {isExpanded && hasItems && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-tan/20 px-5 py-3 max-h-60 overflow-y-auto space-y-2">
                            {(data as { count: number; members: ActionItemMember[] }).members.map(
                              (member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between py-1.5 text-sm"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-ink truncate">
                                      {member.name}
                                    </p>
                                    <p className="text-xs text-ink-soft truncate">
                                      {member.email}
                                    </p>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                          {/* Card footer actions */}
                          <div className="border-t border-tan/20 px-5 py-3 flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyActionEmails(
                                  (data as { count: number; members: ActionItemMember[] }).members,
                                );
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
                            >
                              {copied === 'action-emails' ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              Copy Emails
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleComposeFromCard(card);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Compose Email
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              {/* Pending Applications card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`luxury-card overflow-hidden ${
                  actionItems.pendingApplications.count > 0 ? 'border-amber-200' : ''
                }`}
              >
                <Link
                  href="/admin/applications"
                  className="w-full p-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        actionItems.pendingApplications.count > 0
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-sage/5 border border-sage/10'
                      }`}
                    >
                      <FileText
                        className={`h-5 w-5 ${
                          actionItems.pendingApplications.count > 0
                            ? 'text-amber-600'
                            : 'text-sage'
                        }`}
                      />
                    </div>
                    <div>
                      <p
                        className={`text-2xl font-semibold tabular-nums ${
                          actionItems.pendingApplications.count > 0
                            ? 'text-amber-700'
                            : 'text-ink'
                        }`}
                      >
                        {actionItems.pendingApplications.count}
                      </p>
                      <p className="text-sm text-ink-soft">Pending Applications</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-ink-soft" />
                </Link>
              </motion.div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* COMPOSE EMAIL SECTION                                             */}
          {/* ================================================================= */}
          <section id="compose-email" className="luxury-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/5 border border-sage/10">
                <Mail className="h-5 w-5 text-sage" />
              </div>
              <div>
                <h2 className="text-display-thin text-xl text-ink">Compose Email</h2>
                <p className="text-xs text-ink-soft">
                  Send branded emails to filtered member groups
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Start from template */}
              <div>
                <label className="form-label">Start from template</label>
                <select
                  value={templateKey}
                  onChange={(e) => {
                    const t = templates.find((x) => x.key === e.target.value);
                    if (t) {
                      setTemplateKey(t.key);
                      setSubject(t.subject);
                      setBody(t.body);
                    } else {
                      setTemplateKey('');
                    }
                    setEmailResult(null);
                  }}
                  className="form-input w-full sm:w-auto sm:min-w-[240px]"
                >
                  <option value="">None — write from scratch</option>
                  {templates.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-soft mt-2">
                  Merge fields filled in per recipient:{' '}
                  <code className="text-ink">{'{{firstName}}'}</code>,{' '}
                  <code className="text-ink">{'{{seasonName}}'}</code>,{' '}
                  <code className="text-ink">{'{{duesAmount}}'}</code>.
                </p>
              </div>

              {/* Recipient Filter */}
              <div>
                <label className="form-label">Recipient Filter</label>
                <select
                  value={emailFilter}
                  onChange={(e) => {
                    setEmailFilter(e.target.value);
                    setEmailResult(null);
                  }}
                  className="form-input w-full sm:w-auto sm:min-w-[240px]"
                >
                  {FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {/* Preview recipient count */}
                <div className="flex items-center gap-2 mt-2">
                  <Users className="h-3.5 w-3.5 text-ink-soft" />
                  <p className="text-xs text-ink-soft">
                    {previewLoading ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Counting recipients...
                      </span>
                    ) : previewCount !== null ? (
                      <>
                        <span className="font-semibold text-ink tabular-nums">
                          {previewCount}
                        </span>{' '}
                        recipient{previewCount !== 1 ? 's' : ''} will receive this email
                      </>
                    ) : (
                      'Select a filter to see recipient count'
                    )}
                  </p>
                </div>
              </div>

              {/* Custom emails textarea */}
              <AnimatePresence>
                {emailFilter === 'custom' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="form-label">Custom Email Addresses (one per line)</label>
                    <textarea
                      value={customEmails}
                      onChange={(e) => setCustomEmails(e.target.value)}
                      placeholder={"alice@example.com\nbob@example.com"}
                      rows={5}
                      className="form-input w-full font-mono text-sm"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Subject */}
              <div>
                <label className="form-label">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject"
                  maxLength={200}
                  className="form-input w-full"
                />
                <p className="text-xs text-ink-soft mt-1 tabular-nums">
                  {subject.length}/200 characters
                </p>
              </div>

              {/* Body */}
              <div>
                <label className="form-label">Message Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter email body. This will be formatted with camp branding on the server."
                  rows={8}
                  className="form-input w-full"
                />
              </div>

              {/* Preview with sample data */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-sage hover:opacity-80"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {showPreview ? 'Hide preview' : 'Preview with sample data'}
                </button>
                {showPreview && (
                  <div className="mt-2 rounded-xl border border-tan/30 bg-cream/50 p-4">
                    <p className="text-[11px] uppercase tracking-wide text-ink-soft mb-2">
                      Preview (sample recipient: Jane)
                    </p>
                    <p className="text-sm font-medium text-ink">
                      {applyMergePreview(subject, SAMPLE_MERGE_CONTEXT) || (
                        <span className="text-ink-soft">No subject yet</span>
                      )}
                    </p>
                    <p className="text-sm text-ink mt-2 whitespace-pre-line">
                      {applyMergePreview(body, SAMPLE_MERGE_CONTEXT) || (
                        <span className="text-ink-soft">No body yet</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Send Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-4 pt-2">
                <button
                  onClick={() => setShowSendConfirm(true)}
                  disabled={
                    sendingEmail || !subject.trim() || !body.trim() || previewCount === 0 || previewCount === null
                  }
                  className="cta-primary text-sm px-6 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>{sendingEmail ? 'Sending...' : 'Send Email'}</span>
                </button>
              </div>

              {/* Send Result */}
              {emailResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl border px-4 py-3 ${
                    emailResult.failed > 0
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-green-200 bg-green-50'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      emailResult.failed > 0 ? 'text-amber-700' : 'text-green-700'
                    }`}
                  >
                    {emailResult.sent > 0 && (
                      <>Sent to {emailResult.sent} recipient{emailResult.sent !== 1 ? 's' : ''}</>
                    )}
                    {emailResult.sent > 0 && emailResult.failed > 0 && ', '}
                    {emailResult.failed > 0 && (
                      <>{emailResult.failed} failed</>
                    )}
                    {emailResult.sent === 0 && emailResult.failed === 0 && 'No emails were sent.'}
                  </p>
                  {emailResult.errors && emailResult.errors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {emailResult.errors.map((err, i) => (
                        <li key={i} className="text-xs text-amber-600">
                          {err}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </div>
          </section>

          {/* Confirm Send Dialog */}
          <ConfirmDialog
            open={showSendConfirm}
            onClose={() => setShowSendConfirm(false)}
            onConfirm={handleSendEmail}
            title="Send Mass Email"
            message={`This will send "${applyMergePreview(subject, SAMPLE_MERGE_CONTEXT)}" to ${previewCount ?? 0} recipient${(previewCount ?? 0) !== 1 ? 's' : ''}, each personalized with their own name. This action cannot be undone.`}
            confirmLabel="Send Email"
            variant="warning"
          />

          {/* ================================================================= */}
          {/* QUICK EMAIL LISTS                                                 */}
          {/* ================================================================= */}
          <section className="luxury-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/5 border border-sage/10">
                <Clipboard className="h-5 w-5 text-sage" />
              </div>
              <div>
                <h2 className="text-display-thin text-xl text-ink">Quick Email Lists</h2>
                <p className="text-xs text-ink-soft">
                  One-click copy email lists for common member segments
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {QUICK_LISTS.map((item) => {
                const Icon = item.icon;
                const isLoading = quickListLoading === item.filter;
                const isCopied = copied === `quick-${item.filter}`;

                return (
                  <button
                    key={item.filter}
                    onClick={() => handleQuickCopy(item.filter)}
                    disabled={isLoading}
                    className="flex items-center gap-3 rounded-xl border border-tan/30 p-4 hover:bg-cream transition-colors group text-left disabled:opacity-60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage/5 border border-sage/10 group-hover:bg-sage/10 transition-colors">
                      <Icon className="h-4 w-4 text-sage" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{item.label}</p>
                      <p className="text-xs text-ink-soft">Click to copy emails</p>
                    </div>
                    <div className="shrink-0">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
                      ) : isCopied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-ink-soft group-hover:text-sage transition-colors" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ================================================================= */}
          {/* EMAIL LIST GENERATOR                                              */}
          {/* ================================================================= */}
          <section className="luxury-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/5 border border-sage/10">
                <List className="h-5 w-5 text-sage" />
              </div>
              <div>
                <h2 className="text-display-thin text-xl text-ink">Email List Generator</h2>
                <p className="text-xs text-ink-soft">
                  Generate and copy email lists by filter with full details
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Filter */}
              <div>
                <label className="form-label">Filter</label>
                <select
                  value={listFilter}
                  onChange={(e) => {
                    setListFilter(e.target.value);
                    setEmailList(null);
                  }}
                  className="form-input w-full sm:w-auto sm:min-w-[240px]"
                >
                  {FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom emails for list filter */}
              <AnimatePresence>
                {listFilter === 'custom' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="form-label">Custom Email Addresses (one per line)</label>
                    <textarea
                      value={listCustomEmails}
                      onChange={(e) => setListCustomEmails(e.target.value)}
                      placeholder={"alice@example.com\nbob@example.com"}
                      rows={5}
                      className="form-input w-full font-mono text-sm"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Generate button */}
              <button
                onClick={handleGenerateList}
                disabled={generatingList}
                className="cta-primary text-sm px-6 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingList ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <List className="h-4 w-4" />
                )}
                <span>{generatingList ? 'Generating...' : 'Generate List'}</span>
              </button>

              {/* Results */}
              {emailList && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-sm text-ink-soft">
                      <span className="font-semibold text-ink tabular-nums">
                        {emailList.count}
                      </span>{' '}
                      email{emailList.count !== 1 ? 's' : ''} found
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleCopy(
                            emailList.emails.map((e) => e.email).join(', '),
                            'list-emails',
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
                      >
                        {copied === 'list-emails' ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copy All
                      </button>
                      <button
                        onClick={() =>
                          handleCopy(
                            ['Name,Email', ...emailList.emails.map((e) => `${e.name},${e.email}`)].join(
                              '\n',
                            ),
                            'list-csv',
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
                      >
                        {copied === 'list-csv' ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copy as CSV
                      </button>
                    </div>
                  </div>

                  {/* Scrollable email list */}
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-tan/20 divide-y divide-tan/10">
                    {emailList.emails.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-sm text-ink-soft">No emails found for this filter.</p>
                      </div>
                    ) : (
                      emailList.emails.map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-cream/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink truncate">
                              {entry.name}
                            </p>
                            <p className="text-xs text-ink-soft truncate">{entry.email}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
