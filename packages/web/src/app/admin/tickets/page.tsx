'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ticket as TicketIcon,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Search,
  Plus,
  Send,
  Car,
  Clock,
  UserPlus,
  ArrowRightLeft,
  ClipboardPaste,
  Users,
  Trash2,
} from 'lucide-react';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { EmptyState } from '../../../components/shared/EmptyState';
import { trpc } from '../../../lib/trpc';

type TicketStatus =
  | 'INVITED'
  | 'CONTACTED'
  | 'PURCHASED_CONFIRMED'
  | 'VEHICLE_PASS_CONFIRMED'
  | 'REMOVED'
  | 'GOT_OUTSIDE';

type FilterBucket =
  | 'all'
  | 'INVITED'
  | 'CONTACTED'
  | 'PURCHASED_CONFIRMED'
  | 'VEHICLE_PASS_CONFIRMED'
  | 'REMOVED'
  | 'GOT_OUTSIDE';

const filterBuckets: { id: FilterBucket; label: string; status?: TicketStatus }[] = [
  { id: 'all', label: 'All' },
  { id: 'INVITED', label: 'Invited', status: 'INVITED' },
  { id: 'CONTACTED', label: 'Contacted', status: 'CONTACTED' },
  { id: 'PURCHASED_CONFIRMED', label: 'Purchased', status: 'PURCHASED_CONFIRMED' },
  { id: 'VEHICLE_PASS_CONFIRMED', label: 'Vehicle Pass', status: 'VEHICLE_PASS_CONFIRMED' },
  { id: 'REMOVED', label: 'Removed', status: 'REMOVED' },
  { id: 'GOT_OUTSIDE', label: 'Got Outside', status: 'GOT_OUTSIDE' },
];

function nextActions(status: TicketStatus): { target: TicketStatus; label: string; tone: 'sage' | 'gold' | 'danger' | 'neutral'; icon: React.ComponentType<{ className?: string }> }[] {
  switch (status) {
    case 'INVITED':
      return [
        { target: 'CONTACTED', label: 'Mark contacted', tone: 'sage', icon: Send },
        { target: 'PURCHASED_CONFIRMED', label: 'Mark purchased', tone: 'sage', icon: CheckCircle },
        { target: 'REMOVED', label: 'Remove', tone: 'danger', icon: XCircle },
      ];
    case 'CONTACTED':
      return [
        { target: 'PURCHASED_CONFIRMED', label: 'Mark purchased', tone: 'sage', icon: CheckCircle },
        { target: 'REMOVED', label: 'Remove', tone: 'danger', icon: XCircle },
      ];
    case 'PURCHASED_CONFIRMED':
      return [
        { target: 'VEHICLE_PASS_CONFIRMED', label: 'Add vehicle pass', tone: 'sage', icon: Car },
        { target: 'REMOVED', label: 'Remove', tone: 'danger', icon: XCircle },
      ];
    case 'VEHICLE_PASS_CONFIRMED':
      return [
        { target: 'PURCHASED_CONFIRMED', label: 'Drop vehicle pass', tone: 'neutral', icon: ArrowRightLeft },
        { target: 'REMOVED', label: 'Remove', tone: 'danger', icon: XCircle },
      ];
    case 'REMOVED':
      return [
        { target: 'INVITED', label: 'Restore to list', tone: 'sage', icon: ArrowRightLeft },
      ];
    case 'GOT_OUTSIDE':
      return [];
    default:
      return [];
  }
}

const toneClasses: Record<string, string> = {
  sage: 'bg-sage text-white hover:bg-sage/90',
  gold: 'bg-gold text-white hover:bg-gold/90',
  danger: 'bg-ink-soft text-white hover:bg-ink',
  neutral: 'bg-white border border-tan/40 text-ink-soft hover:bg-cream',
};

const statusLabel: Record<TicketStatus, string> = {
  INVITED: 'Invited',
  CONTACTED: 'Contacted',
  PURCHASED_CONFIRMED: 'Purchased',
  VEHICLE_PASS_CONFIRMED: 'Vehicle Pass',
  REMOVED: 'Removed',
  GOT_OUTSIDE: 'Got Outside',
};

export default function TicketsPage() {
  // Season selector. We hand-roll season pickup here because /admin/tickets is
  // year-scoped and we want it independent of the global AdminSeasonContext
  // (which is keyed on seasonId; we key the tickets API on year for parity
  // with the import script + URL stability).
  const seasonsQuery = trpc.seasons.list.useQuery();
  const [year, setYear] = useState<number | null>(null);
  const activeYear = useMemo(() => {
    if (year != null) return year;
    const list = seasonsQuery.data;
    if (!list || list.length === 0) return null;
    return list.find((s) => s.isActive)?.year ?? list[0].year;
  }, [year, seasonsQuery.data]);

  const ticketsQuery = trpc.tickets.listForSeason.useQuery(
    activeYear ? { year: activeYear } : {},
    { enabled: activeYear != null },
  );
  const utils = trpc.useContext();
  const refresh = () => utils.tickets.listForSeason.invalidate();

  const [filter, setFilter] = useState<FilterBucket>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Mutations
  const updateStatus = trpc.tickets.updateStatus.useMutation({
    onSuccess: () => { refresh(); showNotification('Status updated'); },
    onError: (e) => showNotification(e.message, 'error'),
  });
  const removeAllocation = trpc.tickets.removeAllocation.useMutation({
    onSuccess: () => { refresh(); showNotification('Removed from list'); },
    onError: (e) => showNotification(e.message, 'error'),
  });
  const fulfillFromWaitlist = trpc.tickets.fulfillFromWaitlist.useMutation({
    onSuccess: () => { refresh(); showNotification('Moved to DGS list'); },
    onError: (e) => showNotification(e.message, 'error'),
  });
  const removeWaitlist = trpc.tickets.removeWaitlistEntry.useMutation({
    onSuccess: () => { refresh(); showNotification('Removed from waitlist'); },
    onError: (e) => showNotification(e.message, 'error'),
  });

  const data = ticketsQuery.data;
  const counts = data?.counts;

  const allocations = data?.allocations ?? [];
  const waitlist = data?.waitlist ?? [];

  // Filter + search
  const filtered = useMemo(() => {
    let rows = allocations;
    if (filter !== 'all') {
      rows = rows.filter((r) => r.status === filter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((r) => {
        const name = (r.member?.name ?? r.placeholderName ?? '').toLowerCase();
        const email = (r.member?.email ?? r.placeholderEmail ?? '').toLowerCase();
        const notes = (r.notes ?? '').toLowerCase();
        return name.includes(term) || email.includes(term) || notes.includes(term);
      });
    }
    return rows;
  }, [allocations, filter, searchTerm]);

  const totalQuantity = useMemo(
    () => allocations.filter((a) => a.status === 'PURCHASED_CONFIRMED' || a.status === 'VEHICLE_PASS_CONFIRMED').reduce((sum, a) => sum + (a.quantity ?? 0), 0),
    [allocations],
  );
  const vehiclePassCount = useMemo(
    () => allocations.filter((a) => a.status === 'VEHICLE_PASS_CONFIRMED').length,
    [allocations],
  );

  // Handlers
  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);
  const handleTransition = (id: string, target: TicketStatus) => {
    if (target === 'REMOVED') {
      if (!confirm('Remove this person from the DGS list?')) return;
      removeAllocation.mutate({ id });
    } else {
      updateStatus.mutate({ id, status: target });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-display-thin text-3xl text-ink">DGS Tickets</h1>
          {data?.season && (
            <span className="admin-chip" data-tone="neutral">
              {data.season.year}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          {seasonsQuery.data && seasonsQuery.data.length > 1 && (
            <select
              value={activeYear ?? ''}
              onChange={(e) => { setYear(parseInt(e.target.value, 10)); setExpandedId(null); }}
              className="form-input w-auto py-1.5 text-sm"
              aria-label="Season"
            >
              {[...seasonsQuery.data].sort((a, b) => b.year - a.year).map((s) => (
                <option key={s.id} value={s.year}>
                  {s.year}{s.isActive ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sage px-3 py-1.5 text-sm font-medium text-white hover:bg-sage/90 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Add to DGS
          </button>
          <button
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-tan/40 bg-white px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-cream transition-colors"
          >
            <ClipboardPaste className="h-4 w-4" /> Paste bulk
          </button>
          <button
            onClick={() => setWaitlistOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-tan/40 bg-white px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-cream transition-colors"
          >
            <Plus className="h-4 w-4" /> Waitlist
          </button>
        </div>
      </div>

      {/* Capacity / count banner */}
      {counts && (
        <div className="rounded-xl border border-tan/30 bg-cream px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-2 text-ink"><Users className="h-4 w-4 text-sage" /> <strong>{counts.total}</strong> on list</span>
          <span className="text-ink-soft"><strong className="text-ink">{totalQuantity}</strong> tickets purchased</span>
          <span className="text-ink-soft"><strong className="text-ink">{vehiclePassCount}</strong> vehicle passes</span>
          <span className="text-ink-soft"><strong className="text-ink">{counts.waitlist}</strong> on waitlist</span>
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
            {notification.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter chips + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-wrap gap-2">
          {filterBuckets.map((btn) => {
            const n = btn.id === 'all' ? counts?.total ?? 0 : counts?.[btn.id] ?? 0;
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
            placeholder="Name, email, or notes..."
            className="form-input pl-10"
          />
        </div>
      </div>

      {/* Two-column layout: main list + waitlist sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Main allocations list */}
        <div>
          {ticketsQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
              <p className="text-sm text-ink-soft">Loading DGS list...</p>
            </div>
          ) : ticketsQuery.error ? (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700">{ticketsQuery.error.message}</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={TicketIcon}
              title="No allocations"
              description={
                searchTerm
                  ? `No allocations match "${searchTerm}".`
                  : filter !== 'all'
                    ? `No allocations in this bucket.`
                    : 'No DGS allocations for this season yet. Use "Add to DGS" or "Paste bulk" to get started.'
              }
              action={
                filter !== 'all' || searchTerm
                  ? { label: 'Clear filters', onClick: () => { setFilter('all'); setSearchTerm(''); } }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {/* Header row */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-ink-soft uppercase tracking-wider">
                <div className="col-span-4">Name</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-1 text-center">Qty</div>
                <div className="col-span-1 text-center">VP</div>
                <div className="col-span-3">Status</div>
              </div>

              {filtered.map((t, idx) => {
                const name = t.member?.name ?? t.placeholderName ?? '(unknown)';
                const email = t.member?.email ?? t.placeholderEmail ?? '';
                const lastAction = t.purchasedAt ?? t.contactedAt ?? t.removedAt ?? t.createdAt;
                const isPlaceholder = !t.memberId;

                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx, 12) * 0.02, duration: 0.25 }}
                    className="luxury-card p-0 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpand(t.id)}
                      className="w-full text-left grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-center px-4 py-3 hover:bg-sage/[0.03] transition-colors"
                    >
                      <div className="col-span-4 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {name}
                          {isPlaceholder && <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-soft/60">placeholder</span>}
                        </p>
                        {t.member?.playaName && (
                          <p className="text-xs text-ink-soft truncate">{t.member.playaName}</p>
                        )}
                      </div>
                      <div className="col-span-3 text-sm text-ink-soft truncate">{email}</div>
                      <div className="col-span-1 text-center text-sm text-ink tabular-nums">{t.quantity}</div>
                      <div className="col-span-1 text-center text-sm">
                        {t.vehiclePass ? <Car className="h-4 w-4 text-sage inline" /> : <span className="text-ink-soft/40">—</span>}
                      </div>
                      <div className="col-span-3 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full bg-cream border border-tan/30 text-ink-soft">
                          {statusLabel[t.status as TicketStatus]}
                        </span>
                        {expandedId === t.id ? (
                          <ChevronUp className="h-4 w-4 text-ink-soft shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-ink-soft shrink-0" />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedId === t.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-tan/30 px-4 py-5 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <DetailField label="Member" value={t.member ? `${t.member.name} (${t.member.email})` : '(unlinked placeholder)'} />
                              <DetailField label="Quantity" value={String(t.quantity)} />
                              <DetailField label="Source" value={formatLabel(t.source)} />
                              {t.contactedAt && <DetailField label="Contacted" value={new Date(t.contactedAt).toLocaleString()} />}
                              {t.purchasedAt && <DetailField label="Purchased" value={new Date(t.purchasedAt).toLocaleString()} />}
                              {t.removedAt && <DetailField label="Removed" value={new Date(t.removedAt).toLocaleString()} />}
                              {t.fulfilledAt && <DetailField label="Fulfilled" value={new Date(t.fulfilledAt).toLocaleString()} />}
                              <DetailField label="Last action" value={new Date(lastAction).toLocaleString()} />
                            </div>

                            {t.notes && (
                              <div className="rounded-xl bg-cream border border-tan/20 p-4">
                                <p className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-1">Notes</p>
                                <p className="text-sm text-ink whitespace-pre-wrap">{t.notes}</p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="border-t border-tan/30 pt-4">
                              <div className="flex flex-wrap gap-3">
                                {nextActions(t.status as TicketStatus).map((a) => {
                                  const Icon = a.icon;
                                  return (
                                    <button
                                      key={a.target}
                                      onClick={(e) => { e.stopPropagation(); handleTransition(t.id, a.target); }}
                                      disabled={updateStatus.isPending || removeAllocation.isPending}
                                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${toneClasses[a.tone]}`}
                                    >
                                      {(updateStatus.isPending || removeAllocation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                                      {a.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Waitlist sidebar */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-ink-soft">Waitlist</h2>
            <span className="text-xs text-ink-soft tabular-nums">{waitlist.length}</span>
          </div>
          {waitlist.length === 0 ? (
            <div className="rounded-xl border border-dashed border-tan/40 p-4 text-center text-sm text-ink-soft">
              No one on the waitlist.
            </div>
          ) : (
            <div className="space-y-2">
              {waitlist.map((w) => (
                <div key={w.id} className="luxury-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{w.name}</p>
                      <p className="text-xs text-ink-soft truncate">{w.email ?? '(no email)'}</p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        <Clock className="inline h-3 w-3 -mt-0.5 mr-0.5 text-gold" /> wants {w.quantityRequested}
                      </p>
                    </div>
                  </div>
                  {w.notes && (
                    <p className="mt-2 text-xs text-ink-soft whitespace-pre-wrap">{w.notes}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => fulfillFromWaitlist.mutate({ waitlistId: w.id })}
                      disabled={fulfillFromWaitlist.isPending}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sage px-3 py-1.5 text-xs font-medium text-white hover:bg-sage/90 disabled:opacity-50 transition-colors"
                    >
                      <ArrowRightLeft className="h-3 w-3" /> Fulfill
                    </button>
                    <button
                      onClick={() => { if (confirm('Remove from waitlist?')) removeWaitlist.mutate({ id: w.id }); }}
                      disabled={removeWaitlist.isPending}
                      className="rounded-lg border border-tan/40 bg-white px-2 py-1.5 text-xs text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
                      aria-label="Remove from waitlist"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* Modals */}
      {addOpen && activeYear && (
        <AddAllocationModal year={activeYear} onClose={() => setAddOpen(false)} onSuccess={() => { setAddOpen(false); refresh(); showNotification('Added to DGS'); }} />
      )}
      {bulkOpen && activeYear && (
        <BulkPasteModal year={activeYear} onClose={() => setBulkOpen(false)} onSuccess={(stats) => { setBulkOpen(false); refresh(); showNotification(`Bulk: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped`); }} />
      )}
      {waitlistOpen && activeYear && (
        <AddWaitlistModal year={activeYear} onClose={() => setWaitlistOpen(false)} onSuccess={() => { setWaitlistOpen(false); refresh(); showNotification('Added to waitlist'); }} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────

function formatLabel(s: string): string {
  return s.toLowerCase().split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function DetailField({ label, value, fullWidth = false }: { label: string; value?: string | null; fullWidth?: boolean }) {
  if (!value) return null;
  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <p className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm whitespace-pre-wrap text-ink">{value}</p>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="luxury-card relative w-full max-w-lg p-0 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-tan/20 px-5 py-4">
          <h3 className="text-display-thin text-lg text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink transition-colors" aria-label="Close">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function AddAllocationModal({ year, onClose, onSuccess }: { year: number; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [vehiclePass, setVehiclePass] = useState(false);
  const [notes, setNotes] = useState('');

  const upsert = trpc.tickets.upsertAllocation.useMutation({ onSuccess, onError: (e) => alert(e.message) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    upsert.mutate({
      seasonYear: year,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      quantity: Math.max(0, parseInt(quantity, 10) || 1),
      vehiclePass,
      notes: notes.trim() || null,
    });
  };

  return (
    <ModalShell title="Add to DGS" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="form-label">Name *</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
        </div>
        <div>
          <label className="form-label">Phone</label>
          <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Quantity</label>
            <input className="form-input" type="number" min={0} max={20} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={vehiclePass} onChange={(e) => setVehiclePass(e.target.checked)} />
              Vehicle pass
            </label>
          </div>
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-tan/40 px-4 py-2 text-sm text-ink-soft hover:bg-cream">
            Cancel
          </button>
          <button
            type="submit"
            disabled={upsert.isPending || !name.trim()}
            className="rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:bg-sage/90 disabled:opacity-50"
          >
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'Add'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AddWaitlistModal({ year, onClose, onSuccess }: { year: number; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');

  const add = trpc.tickets.addToWaitlist.useMutation({ onSuccess, onError: (e) => alert(e.message) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    add.mutate({
      seasonYear: year,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      quantityRequested: Math.max(1, parseInt(qty, 10) || 1),
      notes: notes.trim() || null,
    });
  };

  return (
    <ModalShell title="Add to waitlist" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="form-label">Name *</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
        </div>
        <div>
          <label className="form-label">Phone</label>
          <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
        </div>
        <div>
          <label className="form-label">Tickets requested</label>
          <input className="form-input" type="number" min={1} max={20} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-tan/40 px-4 py-2 text-sm text-ink-soft hover:bg-cream">
            Cancel
          </button>
          <button
            type="submit"
            disabled={add.isPending || !name.trim()}
            className="rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:bg-sage/90 disabled:opacity-50"
          >
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'Add'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface ParsedRow {
  name: string;
  email: string | null;
  phone: string | null;
  quantity: number | undefined;
  vehiclePass: boolean | undefined;
  notes: string | null;
}

function parseBulk(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Skip header rows
    if (/^(name|#|number)\s*[\t,]/i.test(line)) continue;

    // Split on tab or comma (but not commas inside quotes — simple split is good enough for paste-from-Sheets)
    const cells = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length === 0) continue;

    const name = cells[0];
    if (!name || name.length < 2) continue;

    const email = cells[1] && /@/.test(cells[1]) ? cells[1].toLowerCase() : null;
    const qtyRaw = cells[2];
    const qty = qtyRaw && /^\d+$/.test(qtyRaw) ? parseInt(qtyRaw, 10) : undefined;
    const vp = cells[3] && /^(y|yes|true|1)$/i.test(cells[3].trim());
    const notes = cells.slice(4).join(' | ').trim() || null;

    rows.push({
      name,
      email,
      phone: null,
      quantity: qty,
      vehiclePass: vp || undefined,
      notes,
    });
  }
  return rows;
}

function BulkPasteModal({ year, onClose, onSuccess }: { year: number; onClose: () => void; onSuccess: (stats: { created: number; updated: number; skipped: number }) => void }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseBulk(text), [text]);

  const bulk = trpc.tickets.bulkAddFromCsv.useMutation({
    onSuccess: (data) => onSuccess(data),
    onError: (e) => alert(e.message),
  });

  const submit = () => {
    if (parsed.length === 0) return;
    bulk.mutate({ seasonYear: year, rows: parsed });
  };

  return (
    <ModalShell title="Bulk paste from spreadsheet" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-ink-soft">
          One row per line. Tab or comma separated. Columns: <code className="text-ink">Name · Email · Quantity · Vehicle&nbsp;Pass · Notes</code>.
          Headers are ignored.
        </p>
        <textarea
          className="form-input font-mono text-xs"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Jamie Rivera\tjamie@example.com\t2\tY\nSam Okafor\tsam@example.com\t2\tY\tSam and Alex`}
        />
        {parsed.length > 0 && (
          <div className="rounded-xl border border-tan/30 bg-cream p-3">
            <p className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-2">Preview: {parsed.length} rows</p>
            <div className="space-y-1 max-h-40 overflow-y-auto text-xs">
              {parsed.slice(0, 20).map((r, i) => (
                <div key={i} className="flex gap-2 text-ink">
                  <span className="w-6 text-ink-soft/60 tabular-nums">{i + 1}.</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="flex-1 truncate text-ink-soft">{r.email ?? '—'}</span>
                  <span className="w-8 text-center text-ink-soft tabular-nums">{r.quantity ?? '—'}</span>
                  <span className="w-8 text-center text-ink-soft">{r.vehiclePass ? 'VP' : ''}</span>
                </div>
              ))}
              {parsed.length > 20 && <div className="text-ink-soft/60">... + {parsed.length - 20} more</div>}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-tan/40 px-4 py-2 text-sm text-ink-soft hover:bg-cream">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={bulk.isPending || parsed.length === 0}
            className="rounded-lg bg-sage px-4 py-2 text-sm font-medium text-white hover:bg-sage/90 disabled:opacity-50"
          >
            {bulk.isPending ? <Loader2 className="h-4 w-4 animate-spin inline" /> : `Import ${parsed.length} rows`}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
