'use client';

/**
 * /admin/members — the merged member management grid (former /admin/roster).
 *
 * One page for the whole post-invite flow. Absorbed the old status-only
 * members grid: season status (inline dropdown + bulk change),
 * sortable columns, select/copy-emails, invite modal, merge-duplicates link.
 * Money/activation tools were already here:
 *   - Dues status (UNPAID / PAID / WAIVED + note)  -> seasonMembers.setDuesStatus
 *   - Activation toggle (Invited / Active)         -> seasonMembers.setActivation
 *   - Record a payment (DUES flips dues=PAID)      -> payments.create
 *   - Housing type + grid power                    -> seasonMembers.updateHousing
 *
 * BOUNDARY (deliberate): every inline write here goes through a manager-gated
 * SeasonMember setter. Heavier member-profile edits (name/email/emergency
 * contact) live behind `members.adminUpdate`, which is leadProcedure — NOT
 * manager — so they are NOT editable inline on this manager page. The name cell
 * links out to /admin/members/{id} for those edits instead.
 *
 * Household / sponsor filters are a known gap: there is no household/sponsor
 * field on SeasonMember/Member (household is on Season.households, sponsor on
 * Application), so those preset pills are shipped DISABLED ("coming soon").
 */

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ClipboardCheck,
  Loader2,
  AlertCircle,
  RefreshCw,
  DollarSign,
  UserCheck,
  UserPlus,
  Hammer,
  Trash2,
  Sparkles,
  Plus,
  Download,
  Upload,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GitMerge,
  Receipt,
} from 'lucide-react';
import { SearchInput } from '../../../components/shared/SearchInput';
import { EmptyState } from '../../../components/shared/EmptyState';
import { Avatar } from '../../../components/shared/Avatar';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';
import {
  fetchRoster,
  setDuesStatus,
  setActivation,
  recordPayment,
  updateSeasonMemberHousing,
  updateSeasonMemberStatus,
  inviteMember,
  importRoster,
  getApiErrorMessage,
  type SeasonMember,
  type RosterImportResult,
} from '../../../lib/adminApi';

// ── Local tRPC helpers (for new mutations that can return HTTP-200 tRPC errors) ──
// The shared trpcMutation in adminApi.ts only throws on non-2xx responses,
// so it misses tRPC application-level errors that come back as HTTP 200.
// These local helpers check the tRPC error body first, matching the pattern
// used on /admin/charges/page.tsx.

/** Extract tRPC application-level error message from an HTTP-200 response body. */
function extractTrpcError(body: unknown): string | null {
  try {
    const b = body as { error?: { json?: { message?: string }; message?: string } };
    return b?.error?.json?.message ?? b?.error?.message ?? null;
  } catch {
    return null;
  }
}

async function trpcQueryRoster<T>(
  path: string,
  input?: Record<string, unknown>,
): Promise<T> {
  const qs = input
    ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : '';
  const res = await fetch(`/api/trpc/${path}${qs}`, { credentials: 'include' });
  const json = await res.json();
  const trpcErr = extractTrpcError(json);
  if (trpcErr) throw new Error(trpcErr);
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  const r = json as { result?: { data?: { json?: T } } };
  return r.result?.data?.json as T;
}

async function trpcMutationRoster<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`/api/trpc/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: body }),
  });
  const json = await res.json();
  const trpcErr = extractTrpcError(json);
  if (trpcErr) throw new Error(trpcErr);
  if (!res.ok) throw new Error(`Mutation failed: ${path}`);
  const r = json as { result?: { data?: { json?: T } } };
  return r.result?.data?.json as T;
}

// ── Charge types (used only in the new per-member charges panel) ──
interface MemberCharge {
  id: string;
  label: string;
  amountCents: number;
  status: string;
  note: string | null;
  createdAt: string;
}

interface CatalogItem {
  id: string;
  name: string;
  amountCents: number;
  active: boolean;
}

// SeasonMember from adminApi doesn't include duesOverrideCents (added by T1 schema).
// Extend locally — the roster query returns the full Prisma row which has it.
type RosterMember = SeasonMember & { duesOverrideCents?: number | null };

const DUES_OPTIONS = ['UNPAID', 'PAID', 'WAIVED'] as const;
type DuesStatus = (typeof DUES_OPTIONS)[number];

const HOUSING_OPTIONS = [
  'TENT', 'SHIFTPOD', 'RV', 'TRAILER', 'DORM', 'SHARED', 'HEXAYURT', 'OTHER',
] as const;
const GRID_OPTIONS = ['NONE', 'AMP_15', 'AMP_30', 'AMP_50'] as const;
const PAYMENT_TYPES = [
  'DUES', 'GRID', 'FOOD', 'RV_VOUCHER', 'BEER_FUND', 'TENT', 'TICKET', 'FUNDRAISING', 'OTHER',
] as const;
const PAYMENT_METHODS = [
  'VENMO', 'ZELLE', 'CASH', 'ACH', 'CARD', 'PAYPAL', 'OTHER',
] as const;
const STATUS_OPTIONS = ['INTERESTED', 'MAYBE', 'CONFIRMED', 'WAITLISTED', 'CANCELLED'] as const;

type SortField = 'name' | 'email' | 'status' | 'dues' | 'housing' | 'payment';
type SortDir = 'asc' | 'desc';

// Server-side preset filters (roster procedure supports these directly).
type Preset =
  | 'duesUnpaid'
  | 'duesPaid'
  | 'duesWaived'
  | 'invitedNotActive'
  | 'buildCrew'
  | 'strikeCrew'
  | 'cancelled';

const PRESETS: { key: Preset; label: string; icon: React.ElementType }[] = [
  { key: 'duesUnpaid', label: 'Dues unpaid', icon: DollarSign },
  { key: 'duesPaid', label: 'Paid', icon: DollarSign },
  { key: 'duesWaived', label: 'Waived', icon: DollarSign },
  { key: 'invitedNotActive', label: 'Invited, not active', icon: UserCheck },
  { key: 'buildCrew', label: 'Build crew', icon: Hammer },
  { key: 'strikeCrew', label: 'Strike crew', icon: Trash2 },
  // Cancelled members are excluded from the default roster view/counts —
  // this pill is the only way to see them.
  { key: 'cancelled', label: 'Cancelled', icon: X },
];

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function gridLabel(g: string): string {
  if (g === 'NONE') return 'No power';
  if (g === 'AMP_15') return '15A';
  if (g === 'AMP_30') return '30A';
  if (g === 'AMP_50') return '50A';
  return g;
}

/** Small flag chip (mirrors the applications-page ProfileTag look). */
function FlagChip({
  children,
  tone,
  hint,
}: {
  children: React.ReactNode;
  tone?: 'warn' | 'muted';
  hint?: string;
}) {
  return (
    <span
      title={hint}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
        tone === 'warn'
          ? 'bg-gold/10 text-gold border-gold/20'
          : tone === 'muted'
          ? 'bg-tan/20 text-ink-soft border-tan/30'
          : 'bg-sage/10 text-sage border-sage/20'
      }`}
    >
      {children}
    </span>
  );
}

function MembersGrid() {
  const { selectedSeasonId, selectedSeason } = useAdminSeason();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<RosterMember[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters / search. Seed `search` from the URL so the applications-page
  // "Open member record" deep link (/admin/roster?search=<email>) filters to
  // the linked member on load instead of dumping the full roster.
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  // Column sorting (client-side over the loaded rows)
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Bulk selection + actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [emailsCopied, setEmailsCopied] = useState(false);

  // Inline season-status editing. The menus render with FIXED positioning
  // (anchored to the trigger's viewport rect) because the table lives inside
  // overflow-x-auto/overflow-hidden containers that clip absolutely-positioned
  // dropdowns whenever few rows are visible (e.g. after a search).
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [statusMenuPos, setStatusMenuPos] = useState<{ top: number; left: number } | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Inline dues-dropdown state
  const [duesEditId, setDuesEditId] = useState<string | null>(null);
  const [duesMenuPos, setDuesMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [waiveNoteId, setWaiveNoteId] = useState<string | null>(null);
  const [waiveNote, setWaiveNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null); // row-level mutation in flight
  const duesDropdownRef = useRef<HTMLDivElement>(null);

  // Record-payment expandable form (one open at a time, keyed by seasonMember id)
  const [payOpenId, setPayOpenId] = useState<string | null>(null);
  const [payType, setPayType] = useState<string>('DUES');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<string>('VENMO');
  const [payNotes, setPayNotes] = useState('');
  const [paySaving, setPaySaving] = useState(false);

  // CSV import modal
  const [showImport, setShowImport] = useState(false);

  // ── Per-member charges panel ─────────────────────────────────────────────
  // One panel open at a time, keyed by seasonMember id.
  const [chargesOpenId, setChargesOpenId] = useState<string | null>(null);
  // Charges loaded per member: { [seasonMemberId]: MemberCharge[] }
  const [chargesMap, setChargesMap] = useState<Record<string, MemberCharge[]>>({});
  const [chargesLoadingId, setChargesLoadingId] = useState<string | null>(null);
  // Catalog items for the selected season (loaded once on first panel open).
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  // Assign-charge form state (one active charge form at a time)
  const [assignOpenId, setAssignOpenId] = useState<string | null>(null);
  const [assignItemId, setAssignItemId] = useState<string>('');
  const [assignLabel, setAssignLabel] = useState('');
  const [assignAmount, setAssignAmount] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  // Void in-flight per charge id
  const [voidingId, setVoidingId] = useState<string | null>(null);
  // Offline "mark paid" picker state (charge id being settled + chosen method)
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState('CASH');
  const [markPaidSaving, setMarkPaidSaving] = useState<string | null>(null);
  // Custom dues override state per row (keyed by seasonMember id)
  const [duesOverrideEditId, setDuesOverrideEditId] = useState<string | null>(null);
  const [duesOverrideAmount, setDuesOverrideAmount] = useState('');
  const [duesOverrideSavingId, setDuesOverrideSavingId] = useState<string | null>(null);

  // Flash a transient notice (auto-clears).
  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }, []);

  // Viewport anchor for a fixed-position menu, clamped so the menu's
  // estimated height stays on screen.
  const menuPosFromEvent = (
    e: React.MouseEvent<HTMLElement>,
    estHeight: number,
  ): { top: number; left: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      top: Math.min(rect.bottom + 4, Math.max(8, window.innerHeight - estHeight)),
      left: rect.left,
    };
  };

  // ── Charges panel helpers ────────────────────────────────────────────────

  const loadCatalog = useCallback(async () => {
    if (catalogLoaded || !selectedSeasonId) return;
    try {
      const items = await trpcQueryRoster<CatalogItem[]>('charges.itemsList', {
        seasonId: selectedSeasonId,
        includeInactive: false,
      });
      setCatalogItems(items ?? []);
    } catch {
      // Catalog failure is non-fatal — assign form falls back to free-form entry.
    } finally {
      setCatalogLoaded(true);
    }
  }, [catalogLoaded, selectedSeasonId]);

  const loadMemberCharges = useCallback(async (seasonMemberId: string) => {
    setChargesLoadingId(seasonMemberId);
    try {
      const charges = await trpcQueryRoster<MemberCharge[]>('charges.listForMember', {
        seasonMemberId,
      });
      setChargesMap((prev) => ({ ...prev, [seasonMemberId]: charges ?? [] }));
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to load charges.');
    } finally {
      setChargesLoadingId(null);
    }
  }, [flash]);

  const openChargesPanel = useCallback(async (sm: RosterMember) => {
    if (chargesOpenId === sm.id) {
      setChargesOpenId(null);
      setAssignOpenId(null);
      return;
    }
    setChargesOpenId(sm.id);
    setAssignOpenId(null);
    await loadCatalog();
    await loadMemberCharges(sm.id);
  }, [chargesOpenId, loadCatalog, loadMemberCharges]);

  const openAssignForm = (smId: string) => {
    if (assignOpenId === smId) {
      setAssignOpenId(null);
      return;
    }
    setAssignOpenId(smId);
    setAssignItemId('');
    setAssignLabel('');
    setAssignAmount('');
    setAssignNote('');
  };

  const handleCatalogItemChange = (itemId: string) => {
    setAssignItemId(itemId);
    if (itemId) {
      const item = catalogItems.find((i) => i.id === itemId);
      if (item) {
        setAssignLabel(item.name);
        setAssignAmount((item.amountCents / 100).toFixed(2));
      }
    } else {
      setAssignLabel('');
      setAssignAmount('');
    }
  };

  const handleAssignCharge = async (sm: RosterMember) => {
    const dollars = parseFloat(assignAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      flash('Enter a valid amount greater than zero.');
      return;
    }
    const amountCents = Math.round(dollars * 100);
    const label = assignLabel.trim();
    if (!label && !assignItemId) {
      flash('Enter a label for the charge.');
      return;
    }
    setAssignSaving(true);
    try {
      await trpcMutationRoster<unknown>('charges.assign', {
        seasonMemberId: sm.id,
        ...(assignItemId ? { itemId: assignItemId } : {}),
        ...(label ? { label } : {}),
        amountCents,
        ...(assignNote.trim() ? { note: assignNote.trim() } : {}),
      });
      flash('Charge assigned.');
      setAssignOpenId(null);
      await loadMemberCharges(sm.id);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to assign charge.');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleVoidCharge = async (chargeId: string, seasonMemberId: string) => {
    setVoidingId(chargeId);
    try {
      await trpcMutationRoster<unknown>('charges.void', { chargeId });
      flash('Charge voided.');
      await loadMemberCharges(seasonMemberId);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to void charge.');
    } finally {
      setVoidingId(null);
    }
  };

  // Settle an OPEN charge with an offline payment (cash/Zelle/…) and mark it paid.
  const handleMarkPaidCharge = async (chargeId: string, seasonMemberId: string) => {
    setMarkPaidSaving(chargeId);
    try {
      await trpcMutationRoster<unknown>('charges.markPaid', { chargeId, method: markPaidMethod });
      flash('Charge marked paid.');
      setMarkPaidId(null);
      await loadMemberCharges(seasonMemberId);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to mark charge paid.');
    } finally {
      setMarkPaidSaving(null);
    }
  };

  const openDuesOverrideEdit = (sm: RosterMember) => {
    if (duesOverrideEditId === sm.id) {
      setDuesOverrideEditId(null);
      return;
    }
    setDuesOverrideEditId(sm.id);
    const current = sm.duesOverrideCents;
    setDuesOverrideAmount(current != null ? (current / 100).toFixed(2) : '');
  };

  const handleSetDuesOverride = async (sm: RosterMember, clearOverride: boolean) => {
    setDuesOverrideSavingId(sm.id);
    const amountCents = clearOverride
      ? null
      : Math.round(parseFloat(duesOverrideAmount) * 100);
    if (!clearOverride) {
      const v = parseFloat(duesOverrideAmount);
      if (!Number.isFinite(v) || v < 0) {
        flash('Enter a valid amount (0 or greater).');
        setDuesOverrideSavingId(null);
        return;
      }
    }
    const prevOverride = sm.duesOverrideCents;
    // Optimistic
    patchRow(sm.id, { duesOverrideCents: amountCents } as Partial<RosterMember>);
    setDuesOverrideEditId(null);
    try {
      await trpcMutationRoster<unknown>('seasonMembers.setDuesOverride', {
        id: sm.id,
        amountCents,
      });
      flash(clearOverride ? 'Custom dues cleared.' : 'Custom dues saved.');
    } catch (err) {
      patchRow(sm.id, { duesOverrideCents: prevOverride } as Partial<RosterMember>);
      flash(err instanceof Error ? err.message : 'Failed to update dues override.');
    } finally {
      setDuesOverrideSavingId(null);
    }
  };

  const loadRoster = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchRoster({
        seasonId: selectedSeasonId || undefined,
        search: search || undefined,
        status: activePreset === 'cancelled' ? 'CANCELLED' : undefined,
        duesStatus:
          activePreset === 'duesUnpaid'
            ? 'UNPAID'
            : activePreset === 'duesPaid'
            ? 'PAID'
            : activePreset === 'duesWaived'
            ? 'WAIVED'
            : undefined,
        invitedNotActive: activePreset === 'invitedNotActive' ? true : undefined,
        buildCrew: activePreset === 'buildCrew' ? true : undefined,
        strikeCrew: activePreset === 'strikeCrew' ? true : undefined,
        limit: 200,
      });
      setRows(result.seasonMembers);
      setTotalCount(result.total);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Unable to load the roster. The server may not be running.');
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [selectedSeasonId, search, activePreset]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Close the dues dropdown on outside click (mirrors members-page pattern).
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (duesDropdownRef.current && !duesDropdownRef.current.contains(e.target as Node)) {
        setDuesEditId(null);
        setWaiveNoteId(null);
      }
    }
    if (duesEditId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [duesEditId]);

  // Close the season-status dropdown on outside click.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setEditingStatusId(null);
      }
    }
    if (editingStatusId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editingStatusId]);

  // The menus are fixed-positioned, so close them on any scroll/resize —
  // otherwise they'd float detached from their row.
  useEffect(() => {
    if (!editingStatusId && !duesEditId) return;
    const close = () => {
      setEditingStatusId(null);
      setDuesEditId(null);
      setWaiveNoteId(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [editingStatusId, duesEditId]);

  // Drop stale selections when the visible set changes.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, activePreset, selectedSeasonId]);

  // Optimistically patch a single row in state.
  const patchRow = useCallback((id: string, patch: Partial<RosterMember>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  // ── Sorting ──────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name':
        cmp = a.member.name.localeCompare(b.member.name);
        break;
      case 'email':
        cmp = a.member.email.localeCompare(b.member.email);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'dues':
        cmp = a.duesStatus.localeCompare(b.duesStatus);
        break;
      case 'housing':
        cmp = (a.housingType || '').localeCompare(b.housingType || '');
        break;
      case 'payment': {
        const aT = a.payments?.[0] ? new Date(a.payments[0].paidAt).getTime() : 0;
        const bT = b.payments?.[0] ? new Date(b.payments[0].paidAt).getTime() : 0;
        cmp = aT - bT;
        break;
      }
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 inline ml-1" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 inline ml-1" />
    );
  };

  // ── Season status (inline + bulk) ────────────────────────────────────
  const handleInlineStatusChange = async (sm: RosterMember, newStatus: string) => {
    setStatusUpdating(sm.id);
    const prev = sm.status;
    patchRow(sm.id, { status: newStatus });
    setEditingStatusId(null);
    try {
      await updateSeasonMemberStatus(sm.id, newStatus);
      // Cancelled members leave the default roster view (see the Cancelled pill).
      if (newStatus === 'CANCELLED' && activePreset !== 'cancelled') {
        setRows((prevRows) => prevRows.filter((r) => r.id !== sm.id));
        setTotalCount((c) => Math.max(0, c - 1));
        flash(`${sm.member.name} cancelled — removed from the roster view.`);
      } else {
        flash(`Status set to ${titleCase(newStatus)}.`);
      }
    } catch (err) {
      patchRow(sm.id, { status: prev });
      flash(getApiErrorMessage(err) || 'Failed to update status.');
    } finally {
      setStatusUpdating(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedRows.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatusValue || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => updateSeasonMemberStatus(id, bulkStatusValue)),
      );
      if (bulkStatusValue === 'CANCELLED' && activePreset !== 'cancelled') {
        // Cancelled members leave the default roster view.
        setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        setTotalCount((c) => Math.max(0, c - selectedIds.size));
      } else {
        setRows((prev) =>
          prev.map((r) => (selectedIds.has(r.id) ? { ...r, status: bulkStatusValue } : r)),
        );
      }
      flash(`${selectedIds.size} member${selectedIds.size !== 1 ? 's' : ''} set to ${titleCase(bulkStatusValue)}.`);
      setSelectedIds(new Set());
      setBulkStatusValue('');
    } catch (err) {
      flash(getApiErrorMessage(err) || 'Some status updates failed — refresh to verify.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleCopyEmails = async () => {
    const emails = sortedRows
      .filter((r) => selectedIds.has(r.id))
      .map((r) => r.member.email)
      .join(', ');
    try {
      await navigator.clipboard.writeText(emails);
      setEmailsCopied(true);
      setTimeout(() => setEmailsCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  // ── Invite member ────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) return;
    try {
      setInviteLoading(true);
      setInviteError(null);
      // Pass the selected season so the invitee is enrolled and shows up
      // in this grid (the server falls back to the active season).
      const result = await inviteMember(inviteEmail, inviteName, selectedSeasonId || undefined);
      setInviteResult(result.inviteToken || 'Invitation sent successfully.');
    } catch (err) {
      setInviteError(getApiErrorMessage(err) || 'Failed to send invitation. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  const closeInviteModal = () => {
    setShowInvite(false);
    setInviteEmail('');
    setInviteName('');
    setInviteResult(null);
    setInviteError(null);
    setInviteCopied(false);
  };

  const handleInviteCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };


  // ── Dues status ──────────────────────────────────────────────────────
  const handleDuesChange = async (sm: RosterMember, next: DuesStatus, note?: string) => {
    setBusyId(sm.id);
    const prev = { duesStatus: sm.duesStatus, duesNote: sm.duesNote };
    patchRow(sm.id, { duesStatus: next, duesNote: note ?? (next === 'WAIVED' ? sm.duesNote : null) });
    setDuesEditId(null);
    setWaiveNoteId(null);
    setWaiveNote('');
    try {
      await setDuesStatus({ id: sm.id, duesStatus: next, note });
      flash(`Dues set to ${titleCase(next)}.`);
    } catch (err) {
      patchRow(sm.id, prev); // roll back
      flash(getApiErrorMessage(err) || 'Failed to update dues.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Activation toggle ────────────────────────────────────────────────
  const handleActivationToggle = async (sm: RosterMember) => {
    const nowActive = sm.activatedAt != null;
    setBusyId(sm.id);
    patchRow(sm.id, { activatedAt: nowActive ? null : new Date().toISOString() });
    try {
      await setActivation({ id: sm.id, activated: !nowActive });
      flash(nowActive ? 'Marked as Invited.' : 'Marked as Active.');
    } catch (err) {
      patchRow(sm.id, { activatedAt: sm.activatedAt ?? null });
      flash(getApiErrorMessage(err) || 'Failed to toggle activation.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Housing / grid power ─────────────────────────────────────────────
  const handleHousingChange = async (sm: RosterMember, field: 'housingType' | 'gridPower', value: string) => {
    setBusyId(sm.id);
    const prevVal = sm[field];
    patchRow(sm.id, { [field]: value || undefined } as Partial<RosterMember>);
    try {
      await updateSeasonMemberHousing(sm.id, { [field]: field === 'housingType' && !value ? null : value });
      flash('Housing updated.');
    } catch (err) {
      patchRow(sm.id, { [field]: prevVal } as Partial<RosterMember>);
      flash(getApiErrorMessage(err) || 'Failed to update housing.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Record payment ───────────────────────────────────────────────────
  const openPaymentForm = (sm: RosterMember) => {
    if (payOpenId === sm.id) {
      setPayOpenId(null);
      return;
    }
    setPayOpenId(sm.id);
    setPayType('DUES');
    setPayAmount('');
    setPayMethod('VENMO');
    setPayNotes('');
  };

  const handleRecordPayment = async (sm: RosterMember) => {
    const dollars = parseFloat(payAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      flash('Enter a valid amount.');
      return;
    }
    setPaySaving(true);
    try {
      const amountCents = Math.round(dollars * 100);
      await recordPayment({
        seasonMemberId: sm.id,
        type: payType,
        amount: amountCents,
        method: payMethod,
        paidAt: new Date().toISOString(),
        notes: payNotes || undefined,
      });
      // Mirror server-side effects optimistically:
      //  - the new payment becomes the "last payment"
      //  - a DUES payment flips duesStatus=PAID in the same transaction server-side
      const newPayment = {
        type: payType,
        amount: amountCents,
        method: payMethod,
        paidAt: new Date().toISOString(),
      };
      patchRow(sm.id, {
        payments: [newPayment],
        ...(payType === 'DUES' ? { duesStatus: 'PAID' as string } : {}),
      });
      setPayOpenId(null);
      flash('Payment recorded.');
    } catch (err) {
      flash(getApiErrorMessage(err) || 'Failed to record payment.');
    } finally {
      setPaySaving(false);
    }
  };

  // ── CSV export (client-side, from loaded rows) ───────────────────────
  const handleExportCsv = () => {
    const headers = [
      'memberId', 'email', 'name', 'playaName', 'phone', 'status',
      'duesStatus', 'duesNote', 'activated', 'housingType', 'housingSize',
      'gridPower', 'buildCrew', 'strikeCrew',
      'lastPaymentType', 'lastPaymentAmount', 'lastPaymentDate',
    ];
    const esc = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      // Quote if the cell contains a comma, quote, or newline.
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) => {
      const last = r.payments && r.payments[0];
      return [
        r.member.id,
        r.member.email,
        r.member.name,
        r.member.playaName || '',
        r.member.phone || r.phone || '',
        r.status,
        r.duesStatus,
        r.duesNote || '',
        r.activatedAt ? 'Y' : 'N',
        r.housingType || '',
        r.housingSize || '',
        r.gridPower,
        r.buildCrew ? 'Y' : 'N',
        r.strikeCrew ? 'Y' : 'N',
        last ? last.type : '',
        last ? centsToDollars(last.amount) : '',
        last ? new Date(last.paidAt).toISOString().slice(0, 10) : '',
      ].map(esc).join(',');
    });
    const csv = [headers.join(','), ...lines].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const seasonTag = selectedSeason ? selectedSeason.name.replace(/\s+/g, '-') : 'season';
    a.download = `roster-${seasonTag}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeCount = rows.filter((r) => r.activatedAt != null).length;
  const unpaidCount = rows.filter((r) => r.duesStatus === 'UNPAID').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display-thin text-3xl text-ink">Members</h1>
          <p className="text-body-relaxed text-sm text-ink-soft mt-1">
            {totalCount} member{totalCount !== 1 ? 's' : ''}
            {selectedSeason ? ` in ${selectedSeason.name}` : ''}
            {!loading && rows.length > 0 && (
              <span className="text-ink-soft/70">
                {' '}&middot; {activeCount} active &middot; {unpaidCount} unpaid
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadRoster}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV</span>
          </button>
          <Link
            href="/admin/members/merge"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
          >
            <GitMerge className="h-3.5 w-3.5" />
            <span>Find duplicates</span>
          </Link>
          <button
            onClick={() => setShowInvite(true)}
            className="cta-primary text-sm px-5 py-2.5 flex items-center gap-2"
          >
            <span><UserPlus className="h-4 w-4" /></span>
            <span>Invite Member</span>
          </button>
        </div>
      </div>


      {/* Notice toast */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="fixed top-20 right-6 z-50 rounded-lg border border-sage/30 bg-white px-4 py-2.5 text-sm text-ink shadow-lg"
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preset filter pills (server-side filters) */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActivePreset(activePreset === key ? null : key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition-colors ${
              activePreset === key
                ? 'bg-gold/10 border-gold text-gold font-semibold'
                : 'border-tan/30 text-ink-soft hover:bg-cream hover:border-tan/50'
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
        {/* Household / sponsor: no field on SeasonMember/Member yet — shipped
            disabled. Wiring needs Application.sponsorMemberId / Season.households. */}
        <button
          disabled
          title="Coming soon — needs the household/sponsor join (out of scope for this grid)"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border border-tan/20 text-ink-soft/40 cursor-not-allowed"
        >
          <Sparkles className="h-3 w-3" />
          Household / sponsor (soon)
        </button>
        {activePreset && (
          <button
            onClick={() => setActivePreset(null)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Toolbar: search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, email, or playa name..."
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
          <button
            onClick={loadRoster}
            className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Loading members...</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No Members Found"
          description={
            search || activePreset
              ? 'No members match your current filters.'
              : 'No members are enrolled in the current season yet.'
          }
          action={
            search || activePreset
              ? {
                  label: 'Clear Filters',
                  onClick: () => {
                    setSearch('');
                    setActivePreset(null);
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="luxury-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sage/10 bg-cream/50">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === sortedRows.length && sortedRows.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-tan/40 text-sage focus:ring-sage/30 cursor-pointer"
                    />
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="text-left py-3 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider cursor-pointer hover:text-ink select-none"
                  >
                    Member <SortIcon field="name" />
                  </th>
                  <th
                    onClick={() => handleSort('email')}
                    className="text-left py-3 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider cursor-pointer hover:text-ink select-none hidden md:table-cell"
                  >
                    Contact <SortIcon field="email" />
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    title="Season participation: Interested / Maybe / Confirmed / Waitlisted / Cancelled. Click the badge in a row to change it."
                    className="text-left py-3 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider cursor-pointer hover:text-ink select-none"
                  >
                    Status <SortIcon field="status" />
                  </th>
                  <th
                    title="Invited = added to the season but hasn't activated their member-portal account yet. Active = has logged in to the portal."
                    className="text-left py-3 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider"
                  >
                    Activation
                  </th>
                  <th
                    onClick={() => handleSort('dues')}
                    title="Season dues: Unpaid / Paid / Waived (comped, with a note). A custom per-member dues amount can be set under the pill."
                    className="text-left py-3 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider cursor-pointer hover:text-ink select-none"
                  >
                    Dues <SortIcon field="dues" />
                  </th>
                  <th
                    onClick={() => handleSort('housing')}
                    className="text-left py-3 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider cursor-pointer hover:text-ink select-none hidden lg:table-cell"
                  >
                    Housing / Power <SortIcon field="housing" />
                  </th>
                  <th
                    title="Quick flags: build/strike crew, BM Virgin (first Burning Man), and whether they're in the camp WhatsApp group."
                    className="text-left py-3 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider hidden xl:table-cell"
                  >
                    Flags
                  </th>
                  <th
                    onClick={() => handleSort('payment')}
                    title="Most recent recorded payment. Use + to record an offline payment and the receipt icon to view/assign charges."
                    className="text-left py-3 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider cursor-pointer hover:text-ink select-none"
                  >
                    Last Payment <SortIcon field="payment" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((sm, idx) => {
                  const isActive = sm.activatedAt != null;
                  const last = sm.payments && sm.payments[0];
                  return (
                    <motion.tr
                      key={sm.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.015, 0.4), duration: 0.2 }}
                      className={`border-b border-sage/5 hover:bg-sage/[0.03] transition-colors align-top ${
                        selectedIds.has(sm.id) ? 'bg-gold/[0.04]' : ''
                      }`}
                    >
                      {/* Bulk-select checkbox */}
                      <td className="py-3 px-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(sm.id)}
                          onChange={() => toggleSelectOne(sm.id)}
                          className="h-4 w-4 rounded border-tan/40 text-sage focus:ring-sage/30 cursor-pointer"
                        />
                      </td>

                      {/* Member (avatar + name/playa, links to detail) */}
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/members/${sm.member.id}`}
                          className="flex items-center gap-2.5 group"
                        >
                          <Avatar
                            name={sm.member.name}
                            memberId={sm.member.id}
                            hasAvatar={sm.member.hasAvatar}
                            size="sm"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-ink group-hover:text-sage transition-colors truncate">
                              {sm.member.name}
                            </span>
                            {sm.member.playaName && (
                              <span className="block text-xs text-ink-soft truncate">
                                &ldquo;{sm.member.playaName}&rdquo;
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        <p className="text-ink-soft text-xs truncate max-w-[200px]">{sm.member.email}</p>
                        {(sm.member.phone || sm.phone) && (
                          <p className="text-ink-soft/70 text-xs">{sm.member.phone || sm.phone}</p>
                        )}
                      </td>

                      {/* Season status (inline editable) */}
                      <td className="py-3 px-4">
                        <button
                          onClick={(e) => {
                            setStatusMenuPos(menuPosFromEvent(e, 190));
                            setEditingStatusId(editingStatusId === sm.id ? null : sm.id);
                          }}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          title="Click to change status"
                        >
                          {statusUpdating === sm.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-sage" />
                          ) : (
                            <StatusBadge status={sm.status} variant="season" />
                          )}
                        </button>
                        {editingStatusId === sm.id && statusMenuPos && (
                          <div
                            ref={statusDropdownRef}
                            style={{ top: statusMenuPos.top, left: statusMenuPos.left }}
                            className="fixed z-50 bg-white rounded-lg shadow-lg border border-tan/30 py-1 min-w-[150px]"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => handleInlineStatusChange(sm, opt)}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-cream transition-colors flex items-center gap-2 ${
                                  sm.status === opt ? 'bg-sage/5 font-semibold' : ''
                                }`}
                              >
                                <StatusBadge status={opt} variant="season" />
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Activation toggle */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleActivationToggle(sm)}
                          disabled={busyId === sm.id}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors disabled:opacity-50 ${
                            isActive
                              ? 'bg-sage/10 text-sage border-sage/30 hover:bg-sage/20'
                              : 'bg-tan/20 text-ink-soft border-tan/40 hover:bg-tan/30'
                          }`}
                          title={
                            isActive
                              ? 'Active — has logged in to the member portal. Click to mark as Invited.'
                              : 'Invited — hasn’t activated their portal account yet. Click to mark as Active.'
                          }
                        >
                          {busyId === sm.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-sage' : 'bg-ink-soft/50'}`} />
                          )}
                          {isActive ? 'Active' : 'Invited'}
                        </button>
                      </td>

                      {/* Dues dropdown */}
                      <td className="py-3 px-4">
                        <button
                          onClick={(e) => {
                            setDuesMenuPos(menuPosFromEvent(e, 250));
                            setDuesEditId(duesEditId === sm.id ? null : sm.id);
                            setWaiveNoteId(null);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors hover:opacity-80"
                          title={
                            sm.duesNote
                              ? `Note: ${sm.duesNote}`
                              : 'Season dues status (Unpaid / Paid / Waived). Click to change it.'
                          }
                        >
                          <DuesPill status={sm.duesStatus} />
                          <ChevronDown className="h-3 w-3 text-ink-soft/50" />
                        </button>
                        {sm.duesNote && (
                          <p className="mt-1 max-w-[160px] truncate text-[10px] text-ink-soft/70" title={sm.duesNote}>
                            {sm.duesNote}
                          </p>
                        )}
                        {duesEditId === sm.id && duesMenuPos && (
                          <div
                            ref={duesDropdownRef}
                            style={{ top: duesMenuPos.top, left: duesMenuPos.left }}
                            className="fixed z-50 bg-white rounded-lg shadow-lg border border-tan/30 py-1 min-w-[180px]"
                          >
                            {DUES_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => {
                                  if (opt === 'WAIVED') {
                                    // Open the inline note input before committing.
                                    setWaiveNoteId(sm.id);
                                    setWaiveNote(sm.duesNote || '');
                                  } else {
                                    handleDuesChange(sm, opt);
                                  }
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-cream transition-colors flex items-center gap-2 ${
                                  sm.duesStatus === opt ? 'bg-sage/5 font-semibold' : ''
                                }`}
                              >
                                <DuesPill status={opt} />
                              </button>
                            ))}
                            {/* WAIVED note input (encouraged per spec) */}
                            {waiveNoteId === sm.id && (
                              <div className="border-t border-tan/20 mt-1 px-2 pt-2 pb-1 space-y-2">
                                <label className="block text-[10px] uppercase tracking-wide text-ink-soft">
                                  Waiver note (who / why)
                                </label>
                                <input
                                  type="text"
                                  value={waiveNote}
                                  onChange={(e) => setWaiveNote(e.target.value)}
                                  placeholder="e.g. board comp"
                                  className="form-input text-xs py-1"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleDuesChange(sm, 'WAIVED', waiveNote || undefined)}
                                  className="w-full px-2 py-1 rounded text-xs font-medium bg-sage text-white hover:bg-sage-700 transition-colors"
                                >
                                  Waive dues
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Custom dues amount override */}
                        {sm.duesStatus !== 'WAIVED' && (
                          <div className="mt-1.5">
                            {duesOverrideEditId === sm.id ? (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] text-ink-soft/60">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={duesOverrideAmount}
                                  onChange={(e) => setDuesOverrideAmount(e.target.value)}
                                  placeholder="custom amt"
                                  className="form-input text-xs py-0.5 w-20"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSetDuesOverride(sm, false)}
                                  disabled={duesOverrideSavingId === sm.id}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sage text-white hover:bg-sage/90 disabled:opacity-50 transition-colors"
                                  title="Save custom dues amount"
                                >
                                  {duesOverrideSavingId === sm.id ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <Check className="h-2.5 w-2.5" />
                                  )}
                                </button>
                                {sm.duesOverrideCents != null && (
                                  <button
                                    onClick={() => handleSetDuesOverride(sm, true)}
                                    disabled={duesOverrideSavingId === sm.id}
                                    className="px-1.5 py-0.5 rounded text-[10px] text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                    title="Clear custom dues (revert to season default)"
                                  >
                                    Clear
                                  </button>
                                )}
                                <button
                                  onClick={() => setDuesOverrideEditId(null)}
                                  className="p-0.5 text-ink-soft hover:text-ink transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => openDuesOverrideEdit(sm)}
                                className="text-[10px] text-ink-soft/60 hover:text-ink-soft transition-colors"
                                title="Set custom dues amount"
                              >
                                {sm.duesOverrideCents != null
                                  ? `Custom: $${centsToDollars(sm.duesOverrideCents)}`
                                  : 'Custom dues…'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Housing + grid power (inline selects) */}
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={sm.housingType || ''}
                            onChange={(e) => handleHousingChange(sm, 'housingType', e.target.value)}
                            disabled={busyId === sm.id}
                            className="form-input text-xs py-1 w-auto min-w-[110px] disabled:opacity-50"
                          >
                            <option value="">— Housing —</option>
                            {HOUSING_OPTIONS.map((h) => (
                              <option key={h} value={h}>{titleCase(h)}</option>
                            ))}
                          </select>
                          <select
                            value={sm.gridPower}
                            onChange={(e) => handleHousingChange(sm, 'gridPower', e.target.value)}
                            disabled={busyId === sm.id}
                            className="form-input text-xs py-1 w-auto min-w-[110px] disabled:opacity-50"
                          >
                            {GRID_OPTIONS.map((g) => (
                              <option key={g} value={g}>{gridLabel(g)}</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Key flags */}
                      <td className="py-3 px-4 hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {sm.buildCrew && <FlagChip hint="On the build crew — arrives early to set up camp">Build</FlagChip>}
                          {sm.strikeCrew && <FlagChip hint="On the strike crew — stays late to tear down camp">Strike</FlagChip>}
                          {sm.isBMVirgin && <FlagChip tone="warn" hint="First Burning Man">BM Virgin</FlagChip>}
                          {sm.addedToWhatsApp ? (
                            <FlagChip hint="In the camp WhatsApp group">WhatsApp</FlagChip>
                          ) : (
                            <FlagChip tone="muted" hint="Not yet added to the camp WhatsApp group">No WhatsApp</FlagChip>
                          )}
                        </div>
                      </td>

                      {/* Last payment + record */}
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            {last ? (
                              <>
                                <p className="text-xs font-medium text-ink">
                                  {titleCase(last.type)} &middot; ${centsToDollars(last.amount)}
                                </p>
                                <p className="text-[10px] text-ink-soft/70">
                                  {new Date(last.paidAt).toLocaleDateString()}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-ink-soft/50">No payments</p>
                            )}
                          </div>
                          <button
                            onClick={() => openPaymentForm(sm)}
                            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-tan/40 px-2 py-1 text-xs text-ink-soft hover:bg-cream transition-colors"
                            title="Record a payment"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => openChargesPanel(sm)}
                            className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                              chargesOpenId === sm.id
                                ? 'border-gold/40 bg-gold/10 text-gold'
                                : 'border-tan/40 text-ink-soft hover:bg-cream'
                            }`}
                            title="View / assign charges"
                          >
                            <Receipt className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Expandable record-payment form */}
                        <AnimatePresence>
                          {payOpenId === sm.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-tan/30 bg-cream/40 p-2">
                                <select
                                  value={payType}
                                  onChange={(e) => setPayType(e.target.value)}
                                  className="form-input text-xs py-1"
                                >
                                  {PAYMENT_TYPES.map((t) => (
                                    <option key={t} value={t}>{titleCase(t)}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  placeholder="$ amount"
                                  className="form-input text-xs py-1"
                                />
                                <select
                                  value={payMethod}
                                  onChange={(e) => setPayMethod(e.target.value)}
                                  className="form-input text-xs py-1"
                                >
                                  {PAYMENT_METHODS.map((m) => (
                                    <option key={m} value={m}>{titleCase(m)}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={payNotes}
                                  onChange={(e) => setPayNotes(e.target.value)}
                                  placeholder="Notes (optional)"
                                  className="form-input text-xs py-1"
                                />
                                <div className="col-span-2 flex justify-end gap-2 pt-0.5">
                                  <button
                                    onClick={() => setPayOpenId(null)}
                                    className="px-2 py-1 rounded text-xs text-ink-soft border border-tan/40 hover:bg-white transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleRecordPayment(sm)}
                                    disabled={paySaving || !payAmount}
                                    className="px-3 py-1 rounded text-xs font-medium bg-sage text-white hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                  >
                                    {paySaving && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Record
                                  </button>
                                </div>
                                {payType === 'DUES' && (
                                  <p className="col-span-2 text-[10px] text-ink-soft/70">
                                    A DUES payment marks dues Paid automatically.
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Expandable charges panel */}
                        <AnimatePresence>
                          {chargesOpenId === sm.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 rounded-lg border border-gold/20 bg-gold/[0.04] p-2 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] uppercase tracking-wide text-ink-soft font-medium">
                                    Charges
                                  </p>
                                  <button
                                    onClick={() => openAssignForm(sm.id)}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors ${
                                      assignOpenId === sm.id
                                        ? 'border-gold/40 bg-gold/10 text-gold'
                                        : 'border-tan/40 text-ink-soft hover:bg-cream'
                                    }`}
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                    Add charge
                                  </button>
                                </div>

                                {/* Assign charge form */}
                                <AnimatePresence>
                                  {assignOpenId === sm.id && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-tan/30 bg-cream/60 p-2 mt-1">
                                        {/* Catalog picker */}
                                        <div className="col-span-2">
                                          <select
                                            value={assignItemId}
                                            onChange={(e) => handleCatalogItemChange(e.target.value)}
                                            className="form-input text-xs py-1 w-full"
                                          >
                                            <option value="">— Free-form (no catalog item) —</option>
                                            {catalogItems.map((item) => (
                                              <option key={item.id} value={item.id}>
                                                {item.name} (${centsToDollars(item.amountCents)})
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        {/* Label */}
                                        <input
                                          type="text"
                                          value={assignLabel}
                                          onChange={(e) => setAssignLabel(e.target.value)}
                                          placeholder="Label *"
                                          className="form-input text-xs py-1"
                                        />
                                        {/* Amount */}
                                        <div className="relative flex items-center">
                                          <span className="pointer-events-none absolute left-2.5 text-ink-soft text-xs">$</span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={assignAmount}
                                            onChange={(e) => setAssignAmount(e.target.value)}
                                            placeholder="Amount"
                                            className="form-input text-xs py-1 pl-5 w-full"
                                          />
                                        </div>
                                        {/* Note */}
                                        <input
                                          type="text"
                                          value={assignNote}
                                          onChange={(e) => setAssignNote(e.target.value)}
                                          placeholder="Note (optional)"
                                          className="form-input text-xs py-1 col-span-2"
                                        />
                                        <div className="col-span-2 flex justify-end gap-2 pt-0.5">
                                          <button
                                            onClick={() => setAssignOpenId(null)}
                                            className="px-2 py-1 rounded text-xs text-ink-soft border border-tan/40 hover:bg-white transition-colors"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={() => handleAssignCharge(sm)}
                                            disabled={assignSaving || (!assignLabel.trim() && !assignItemId) || !assignAmount}
                                            className="px-3 py-1 rounded text-xs font-medium bg-gold text-white hover:bg-gold/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                          >
                                            {assignSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                                            Assign
                                          </button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* Charges list */}
                                {chargesLoadingId === sm.id ? (
                                  <div className="flex items-center gap-2 text-[10px] text-ink-soft py-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Loading charges…
                                  </div>
                                ) : (chargesMap[sm.id] ?? []).length === 0 ? (
                                  <p className="text-[10px] text-ink-soft/50 py-1">No charges.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {(chargesMap[sm.id] ?? []).map((charge) => (
                                      <div
                                        key={charge.id}
                                        className="flex items-center justify-between gap-2 rounded border border-tan/20 bg-white/60 px-2 py-1"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <span className="text-[11px] font-medium text-ink truncate block">
                                            {charge.label}
                                          </span>
                                          <span className="text-[10px] text-ink-soft/70">
                                            ${centsToDollars(charge.amountCents)}
                                            {' · '}
                                            <span className={
                                              charge.status === 'OPEN'
                                                ? 'text-gold'
                                                : charge.status === 'PAID'
                                                ? 'text-sage'
                                                : 'text-ink-soft/50 line-through'
                                            }>
                                              {titleCase(charge.status)}
                                            </span>
                                          </span>
                                        </div>
                                        {charge.status === 'OPEN' && (
                                          markPaidId === charge.id ? (
                                            <div className="flex shrink-0 items-center gap-1">
                                              <select
                                                value={markPaidMethod}
                                                onChange={(e) => setMarkPaidMethod(e.target.value)}
                                                className="form-input text-[10px] py-0.5 px-1"
                                                title="Payment method"
                                              >
                                                {PAYMENT_METHODS.map((m) => (
                                                  <option key={m} value={m}>{titleCase(m)}</option>
                                                ))}
                                              </select>
                                              <button
                                                onClick={() => handleMarkPaidCharge(charge.id, sm.id)}
                                                disabled={markPaidSaving === charge.id}
                                                className="px-1.5 py-0.5 rounded text-[10px] text-white bg-sage hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                              >
                                                {markPaidSaving === charge.id ? (
                                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                ) : (
                                                  'Confirm'
                                                )}
                                              </button>
                                              <button
                                                onClick={() => setMarkPaidId(null)}
                                                className="px-1.5 py-0.5 rounded text-[10px] text-ink-soft border border-tan/40 hover:bg-white transition-colors"
                                                title="Cancel"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex shrink-0 items-center gap-1">
                                              <button
                                                onClick={() => { setMarkPaidId(charge.id); setMarkPaidMethod('CASH'); }}
                                                className="px-2 py-0.5 rounded text-[10px] text-sage border border-sage/30 hover:bg-sage/5 transition-colors"
                                                title="Record an offline payment (cash / Zelle / …) for this charge"
                                              >
                                                Mark paid
                                              </button>
                                              <button
                                                onClick={() => handleVoidCharge(charge.id, sm.id)}
                                                disabled={voidingId === charge.id}
                                                className="px-2 py-0.5 rounded text-[10px] text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center gap-1"
                                                title="Void this charge"
                                              >
                                                {voidingId === charge.id ? (
                                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                ) : (
                                                  'Void'
                                                )}
                                              </button>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-sage/10 px-4 py-2.5 text-xs text-ink-soft">
            Showing {rows.length} of {totalCount} (loads up to 200 rows).
          </div>
        </div>
      )}

      {/* CSV import modal */}
      <AnimatePresence>
        {showImport && (
          <ImportModal
            onClose={() => setShowImport(false)}
            onDone={() => {
              setShowImport(false);
              loadRoster();
            }}
          />
        )}
      </AnimatePresence>

      {/* Bulk actions toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-ink border-t border-gold/30 shadow-2xl"
          >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gold tabular-nums">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-white/50 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <select
                    value={bulkStatusValue}
                    onChange={(e) => setBulkStatusValue(e.target.value)}
                    className="rounded-lg bg-white/10 border border-white/20 text-white text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gold"
                  >
                    <option value="" className="text-ink">Change Status...</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s} className="text-ink">
                        {titleCase(s)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkStatusChange}
                    disabled={!bulkStatusValue || bulkLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gold text-ink hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {bulkLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    Apply
                  </button>
                </div>
                <button
                  onClick={handleCopyEmails}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 text-white hover:bg-white/10 transition-colors"
                >
                  {emailsCopied ? (
                    <>
                      <Check className="h-3 w-3 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy Emails
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite member modal */}
      <AnimatePresence>
        {showInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeInviteModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative luxury-card p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-display-thin text-xl text-ink">
                  Invite Member
                </h2>
                <button
                  onClick={closeInviteModal}
                  className="p-1 rounded-lg hover:bg-cream transition-colors"
                >
                  <X className="h-5 w-5 text-ink-soft" />
                </button>
              </div>

              {inviteResult ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                    <Check className="h-5 w-5 text-green-500 shrink-0" />
                    <p className="text-sm text-green-700">Invitation created successfully.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="form-label">Invite Token</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inviteResult}
                        readOnly
                        className="form-input flex-1 text-sm"
                      />
                      <button
                        onClick={() => handleInviteCopy(inviteResult)}
                        className="px-3 py-2 rounded-lg border border-tan/40 hover:bg-cream transition-colors"
                      >
                        {inviteCopied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-ink-soft" />
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      closeInviteModal();
                      loadRoster();
                    }}
                    className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {inviteError && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                      <p className="text-sm text-amber-800">{inviteError}</p>
                    </div>
                  )}
                  <div>
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Enter full name"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Enter email address"
                      className="form-input"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={closeInviteModal}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleInvite}
                      disabled={inviteLoading || !inviteEmail.trim() || !inviteName.trim()}
                      className="px-4 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {inviteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Send Invite
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom spacer so the bulk toolbar doesn't cover the last rows */}
      {selectedIds.size > 0 && <div className="h-16" />}
    </div>
  );
}

// useSearchParams() must sit under a Suspense boundary (Next.js App Router),
// so the grid is wrapped here rather than reading the param at the page root.
export default function MembersPage() {
  return (
    <Suspense fallback={null}>
      <MembersGrid />
    </Suspense>
  );
}

/** Dues status pill with semantic colors. */
function DuesPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: 'bg-sage/15 text-sage',
    WAIVED: 'bg-gold/15 text-gold',
    UNPAID: 'bg-error/10 text-error',
  };
  const cls = map[status] || 'bg-tan/30 text-ink-soft';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {titleCase(status)}
    </span>
  );
}

/**
 * CSV import modal — two-phase (dry-run preview then apply).
 *  1. <input type=file> -> FileReader.readAsDataURL -> base64
 *  2. importRoster({ fileBase64, dryRun: true }) renders the diff
 *  3. confirm -> importRoster({ fileBase64, dryRun: false }) -> reload
 *
 * The import is SAFE: it only updates dues / activation / housing on matched
 * SeasonMembers, never creates/deletes members, and never writes payments.
 */
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<RosterImportResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applied, setApplied] = useState<RosterImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setErr(null);
    setPreview(null);
    setApplied(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setFileBase64(base64);
      try {
        setPreviewLoading(true);
        const result = await importRoster({ fileBase64: base64, dryRun: true });
        setPreview(result);
      } catch (e) {
        setErr(getApiErrorMessage(e) || 'Failed to preview the file. Check the CSV format.');
      } finally {
        setPreviewLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = async () => {
    if (!fileBase64) return;
    try {
      setApplyLoading(true);
      setErr(null);
      const result = await importRoster({ fileBase64, dryRun: false });
      setApplied(result);
    } catch (e) {
      setErr(getApiErrorMessage(e) || 'Failed to apply the import.');
    } finally {
      setApplyLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative luxury-card p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-display-thin text-xl text-ink">Import Roster CSV</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-cream transition-colors">
            <X className="h-5 w-5 text-ink-soft" />
          </button>
        </div>

        <p className="text-xs text-ink-soft mb-4">
          Updates <strong>dues</strong>, <strong>activation</strong>, and{' '}
          <strong>housing</strong> on existing members in the active season, matched
          by <code>memberId</code> or <code>email</code>. Unknown rows are rejected.
          Member name/email are never changed, and payments are never written.
        </p>

        {/* Result of a completed apply */}
        {applied ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <Check className="h-5 w-5 text-green-500 shrink-0" />
              <p className="text-sm text-green-700">
                Applied: {applied.updated ?? 0} updated
                {applied.failed ? `, ${applied.failed} failed` : ''} &middot;{' '}
                {applied.matched} matched / {applied.unmatched} unmatched.
              </p>
            </div>
            {applied.errors.length > 0 && (
              <ImportErrors errors={applied.errors} />
            )}
            <button
              onClick={onDone}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File picker */}
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-tan/40 px-4 py-8 cursor-pointer hover:bg-cream/50 transition-colors">
              <Upload className="h-6 w-6 text-ink-soft/50" />
              <span className="text-sm text-ink-soft">
                {fileName || 'Choose a roster CSV file'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>

            {err && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800">{err}</p>
              </div>
            )}

            {previewLoading && (
              <div className="flex items-center gap-2 text-sm text-ink-soft">
                <Loader2 className="h-4 w-4 animate-spin" />
                Building preview...
              </div>
            )}

            {/* Dry-run preview diff */}
            {preview && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <PreviewStat label="Matched" value={preview.matched} />
                  <PreviewStat label="Unmatched" value={preview.unmatched} tone={preview.unmatched ? 'warn' : undefined} />
                  <PreviewStat label="Changes" value={preview.changeCount} />
                </div>

                {preview.changes && preview.changes.length > 0 && (
                  <div className="rounded-lg border border-tan/30 overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-cream/60 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-1.5 text-ink-soft font-medium">Member</th>
                          <th className="text-left px-3 py-1.5 text-ink-soft font-medium">Field</th>
                          <th className="text-left px-3 py-1.5 text-ink-soft font-medium">From → To</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.changes.map((c, i) => (
                          <tr key={i} className="border-t border-sage/5">
                            <td className="px-3 py-1.5 text-ink">{c.name}</td>
                            <td className="px-3 py-1.5 text-ink-soft">{c.field}</td>
                            <td className="px-3 py-1.5 text-ink-soft">
                              <span className="text-ink-soft/60">{c.from ?? '∅'}</span>
                              {' → '}
                              <span className="text-ink font-medium">{c.to ?? '∅'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {preview.changeCount === 0 && (
                  <p className="text-sm text-ink-soft">No changes detected in this file.</p>
                )}

                {preview.errors.length > 0 && <ImportErrors errors={preview.errors} />}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={applyLoading || preview.changeCount === 0}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {applyLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Apply {preview.changeCount} change{preview.changeCount !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function PreviewStat({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone === 'warn' ? 'border-gold/30 bg-gold/5' : 'border-tan/30 bg-cream/40'}`}>
      <p className={`text-lg font-semibold tabular-nums ${tone === 'warn' ? 'text-gold' : 'text-ink'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</p>
    </div>
  );
}

function ImportErrors({ errors }: { errors: string[] }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 max-h-32 overflow-y-auto">
      <p className="text-xs font-medium text-amber-800 mb-1">{errors.length} issue{errors.length !== 1 ? 's' : ''}:</p>
      <ul className="space-y-0.5">
        {errors.map((e, i) => (
          <li key={i} className="text-[11px] text-amber-700">{e}</li>
        ))}
      </ul>
    </div>
  );
}
