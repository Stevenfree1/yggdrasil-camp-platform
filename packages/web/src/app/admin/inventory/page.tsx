'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MapPin,
  PackagePlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { EmptyState } from '../../../components/shared/EmptyState';
import { trpc } from '../../../lib/trpc';
import { useAuth } from '../../../contexts/AuthContext';

const CATEGORIES = [
  'SHADE',
  'TENT',
  'AC_UNIT',
  'MATTRESS',
  'COT',
  'KITCHEN',
  'BIKE',
  'RUG',
  'CONTAINER',
  'GENERATOR',
  'TOOLS',
  'ELECTRICAL',
  'SOUND',
  'DECOR',
  'FURNITURE',
  'CONSUMABLES',
  'OTHER',
] as const;

type Category = (typeof CATEGORIES)[number];

interface ItemDraft {
  id?: string;
  category: Category;
  name: string;
  description: string;
  quantity: number;
  dimensions: string;
  condition: string;
  storageLocation: string;
  notes: string;
}

const EMPTY_DRAFT: ItemDraft = {
  category: 'OTHER',
  name: '',
  description: '',
  quantity: 1,
  dimensions: '',
  condition: 'good',
  storageLocation: '',
  notes: '',
};

function label(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function conditionClass(condition: string | null): string {
  const value = condition?.toLowerCase() ?? '';
  if (value === 'good' || value === 'new') return 'bg-sage/10 text-sage';
  if (value.includes('replace')) return 'bg-red-50 text-red-700';
  if (value === 'fair') return 'bg-gold/10 text-amber-800';
  return 'bg-tan/30 text-ink-soft';
}

export default function InventoryPage() {
  const { user } = useAuth();
  const isLead = user?.role === 'LEAD';
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<'ALL' | Category>('ALL');
  const [location, setLocation] = useState('ALL');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const inventory = trpc.inventory.list.useQuery({
    search: debouncedSearch || undefined,
    category: category === 'ALL' ? undefined : category,
    storageLocation: location === 'ALL' ? undefined : location,
    attentionOnly,
  });

  const save = trpc.inventory.upsert.useMutation({
    onSuccess: async () => {
      await utils.inventory.list.invalidate();
      toast.success(draft?.id ? 'Inventory item updated.' : 'Inventory item added.');
      setDraft(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.inventory.delete.useMutation({
    onSuccess: async () => {
      await utils.inventory.list.invalidate();
      toast.success('Inventory item removed.');
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const stats = inventory.data?.stats;
  const rows = inventory.data?.rows ?? [];
  const categorySummary = useMemo(
    () =>
      stats?.byCategory
        .slice()
        .sort((a, b) => b.rows - a.rows)
        .slice(0, 8) ?? [],
    [stats]
  );

  const editItem = (item: (typeof rows)[number]) => {
    setDraft({
      id: item.id,
      category: item.category,
      name: item.name,
      description: item.description ?? '',
      quantity: item.quantity,
      dimensions: item.dimensions ?? '',
      condition: item.condition ?? '',
      storageLocation: item.storageLocation ?? '',
      notes: item.notes ?? '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
            Physical operations
          </p>
          <h1 className="font-display text-2xl text-ink">Camp inventory</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            The storage audit, current condition, and container location for camp-owned equipment.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inventory.refetch()}
            disabled={inventory.isFetching}
            className="inline-flex items-center gap-2 rounded-md border border-tan/40 px-3 py-2 text-sm text-ink-soft hover:text-gold disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${inventory.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY_DRAFT })}
            className="cta-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <PackagePlus className="h-4 w-4" /> Add item
          </button>
        </div>
      </div>

      {inventory.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load inventory: {inventory.error.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={Boxes}
          label="Inventory rows"
          value={stats?.rows ?? '—'}
          detail={`${stats?.quantity ?? 0} total units`}
        />
        <SummaryCard
          icon={ClipboardCheck}
          label="Photo audit"
          value={stats?.audited ?? '—'}
          detail="photo-backed rows"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Needs follow-up"
          value={stats?.needsAttention ?? '—'}
          detail="count, test, repair, or locate"
          warning
        />
        <SummaryCard
          icon={MapPin}
          label="Storage zones"
          value={stats?.locations.length ?? '—'}
          detail="named locations"
        />
      </div>

      <div className="luxury-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/60" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="form-input pl-9"
              placeholder="Search item, note, or location…"
              aria-label="Search inventory"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as 'ALL' | Category)}
            className="form-input lg:w-48"
            aria-label="Filter by category"
          >
            <option value="ALL">All categories</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="form-input lg:w-56"
            aria-label="Filter by storage location"
          >
            <option value="ALL">All locations</option>
            {stats?.locations.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={attentionOnly}
            onClick={() => setAttentionOnly((value) => !value)}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${attentionOnly ? 'border-gold bg-gold/10 text-ink' : 'border-tan/40 text-ink-soft hover:text-gold'}`}
          >
            <AlertTriangle className="h-4 w-4" /> Needs follow-up
          </button>
        </div>
      </div>

      {categorySummary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categorySummary.map((entry) => (
            <button
              key={entry.category}
              type="button"
              onClick={() => setCategory(entry.category)}
              className="rounded-full border border-tan/30 bg-white/50 px-3 py-1.5 text-xs text-ink-soft hover:border-gold/50 hover:text-ink"
            >
              {label(entry.category)} · {entry.rows}
            </button>
          ))}
        </div>
      )}

      <div className="luxury-card overflow-hidden p-0">
        {inventory.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin text-gold" /> Loading inventory…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No inventory matches"
            description="Clear a filter or add a new camp item."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-tan/25 bg-cream/60 text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 text-center font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Condition</th>
                  <th className="px-4 py-3 font-semibold">Storage</th>
                  <th className="px-4 py-3 font-semibold">Follow-up</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/20">
                {rows.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-cream/35">
                    <td className="max-w-sm px-4 py-3">
                      <div className="font-medium text-ink">{item.name}</div>
                      {item.dimensions && (
                        <div className="mt-0.5 text-xs text-ink-soft">{item.dimensions}</div>
                      )}
                      {item.notes && (
                        <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft/80">
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{label(item.category)}</td>
                    <td className="px-4 py-3 text-center font-medium tabular-nums text-ink">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${conditionClass(item.condition)}`}
                      >
                        {item.condition ? label(item.condition) : 'Not checked'}
                      </span>
                    </td>
                    <td className="max-w-[190px] px-4 py-3 text-ink-soft">
                      {item.storageLocation ?? 'Unlocated'}
                    </td>
                    <td className="px-4 py-3">
                      {item.needsAttention ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5" /> Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-sage">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => editItem(item)}
                          className="rounded p-2 text-ink-soft hover:bg-gold/10 hover:text-gold"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isLead && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                            className="rounded p-2 text-ink-soft hover:bg-red-50 hover:text-red-700"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {draft && (
        <ItemModal
          draft={draft}
          saving={save.isPending}
          locations={stats?.locations ?? []}
          onClose={() => setDraft(null)}
          onChange={setDraft}
          onSave={() =>
            save.mutate({
              ...draft,
              description: draft.description.trim() || null,
              dimensions: draft.dimensions.trim() || null,
              condition: draft.condition.trim() || null,
              storageLocation: draft.storageLocation.trim() || null,
              notes: draft.notes.trim() || null,
            })
          }
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id })}
        title="Delete inventory item?"
        message={`Remove “${deleteTarget?.name ?? ''}” from the inventory ledger? This does not remove any physical equipment.`}
        confirmLabel="Delete item"
        variant="danger"
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label: title,
  value,
  detail,
  warning = false,
}: {
  icon: typeof Boxes;
  label: string;
  value: string | number;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className="luxury-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
          {title}
        </span>
        <Icon className={`h-4 w-4 ${warning ? 'text-amber-700' : 'text-gold'}`} />
      </div>
      <div className={`mt-2 font-display text-3xl ${warning ? 'text-amber-800' : 'text-ink'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-ink-soft">{detail}</div>
    </div>
  );
}

function ItemModal({
  draft,
  saving,
  locations,
  onClose,
  onChange,
  onSave,
}: {
  draft: ItemDraft;
  saving: boolean;
  locations: string[];
  onClose: () => void;
  onChange: (draft: ItemDraft) => void;
  onSave: () => void;
}) {
  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
    onChange({ ...draft, [key]: value });
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-item-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="luxury-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
              Inventory ledger
            </p>
            <h2 id="inventory-item-title" className="font-display text-xl text-ink">
              {draft.id ? 'Edit item' : 'Add item'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-soft hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="form-label">Name</span>
            <input
              value={draft.name}
              onChange={(event) => set('name', event.target.value)}
              className="form-input"
              maxLength={200}
              autoFocus
            />
          </label>
          <label>
            <span className="form-label">Category</span>
            <select
              value={draft.category}
              onChange={(event) => set('category', event.target.value as Category)}
              className="form-input"
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">Quantity</span>
            <input
              type="number"
              min={0}
              max={100000}
              value={draft.quantity}
              onChange={(event) => set('quantity', Number(event.target.value))}
              className="form-input"
            />
          </label>
          <label>
            <span className="form-label">Condition</span>
            <input
              value={draft.condition}
              onChange={(event) => set('condition', event.target.value)}
              className="form-input"
              placeholder="new, good, fair, unknown…"
              list="inventory-conditions"
            />
            <datalist id="inventory-conditions">
              <option value="new" />
              <option value="good" />
              <option value="fair" />
              <option value="unknown" />
              <option value="needs replacement" />
            </datalist>
          </label>
          <label>
            <span className="form-label">Dimensions</span>
            <input
              value={draft.dimensions}
              onChange={(event) => set('dimensions', event.target.value)}
              className="form-input"
              placeholder="10x20, 6m x 12m…"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="form-label">Storage location</span>
            <input
              value={draft.storageLocation}
              onChange={(event) => set('storageLocation', event.target.value)}
              className="form-input"
              placeholder="KITCHEN container"
              list="inventory-locations"
            />
            <datalist id="inventory-locations">
              {locations.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="sm:col-span-2">
            <span className="form-label">Description</span>
            <textarea
              value={draft.description}
              onChange={(event) => set('description', event.target.value)}
              className="form-input min-h-20"
              maxLength={1000}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="form-label">Notes / follow-up</span>
            <textarea
              value={draft.notes}
              onChange={(event) => set('notes', event.target.value)}
              className="form-input min-h-28"
              maxLength={2000}
              placeholder="Photo reference, test result, repair need, or next count…"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-tan/40 px-4 py-2 text-sm text-ink-soft hover:bg-cream"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!draft.name.trim() || saving}
            className="cta-primary inline-flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save item
          </button>
        </div>
      </div>
    </div>
  );
}
