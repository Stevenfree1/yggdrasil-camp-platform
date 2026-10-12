'use client';

/**
 * Announcements management tab on /admin/communications.
 *
 * Creates/edits the announcements members see at /members/announcements.
 * All mutations are lead-gated server-side (announcements router); the tab
 * itself renders for any admin user but writes fail for non-leads.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone,
  Plus,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  X,
  Check,
} from 'lucide-react';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { EmptyState } from '../../../components/shared/EmptyState';
import {
  fetchAnnouncementsAdmin,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getApiErrorMessage,
  type Announcement,
  type AnnouncementPriority,
} from '../../../lib/adminApi';

const PRIORITIES: AnnouncementPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const PRIORITY_STYLES: Record<AnnouncementPriority, string> = {
  LOW: 'bg-tan/20 text-ink-soft border-tan/30',
  NORMAL: 'bg-sage/10 text-sage border-sage/20',
  HIGH: 'bg-gold/10 text-gold border-gold/20',
  URGENT: 'bg-error/10 text-error border-error/20',
};

function PriorityBadge({ priority }: { priority: AnnouncementPriority }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PRIORITY_STYLES[priority]}`}
    >
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}

interface FormState {
  id: string | null; // null = creating
  title: string;
  content: string;
  priority: AnnouncementPriority;
  isPublished: boolean;
  expiresAt: string; // yyyy-mm-dd or ''
}

const emptyForm: FormState = {
  id: null,
  title: '',
  content: '',
  priority: 'NORMAL',
  isPublished: true,
  expiresAt: '',
};

/** yyyy-mm-dd (local date input) -> end-of-day ISO datetime for the API. */
function dateInputToIso(d: string): string | undefined {
  if (!d) return undefined;
  return new Date(`${d}T23:59:59`).toISOString();
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export function AnnouncementsTab() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchAnnouncementsAdmin();
      setItems(result.announcements);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Unable to load announcements.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => setForm({ ...emptyForm });
  const openEdit = (a: Announcement) =>
    setForm({
      id: a.id,
      title: a.title,
      content: a.content,
      priority: a.priority,
      isPublished: a.isPublished,
      expiresAt: isoToDateInput(a.expiresAt),
    });

  const handleSave = async () => {
    if (!form || !form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (form.id) {
        await updateAnnouncement({
          id: form.id,
          title: form.title.trim(),
          content: form.content.trim(),
          priority: form.priority,
          isPublished: form.isPublished,
          expiresAt: form.expiresAt ? dateInputToIso(form.expiresAt)! : null,
        });
        flash('Announcement updated.');
      } else {
        await createAnnouncement({
          title: form.title.trim(),
          content: form.content.trim(),
          priority: form.priority,
          isPublished: form.isPublished,
          expiresAt: dateInputToIso(form.expiresAt),
        });
        flash('Announcement created.');
      }
      setForm(null);
      await load();
    } catch (err) {
      flash(getApiErrorMessage(err) || 'Failed to save the announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (a: Announcement) => {
    setTogglingId(a.id);
    try {
      await updateAnnouncement({ id: a.id, isPublished: !a.isPublished });
      setItems((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, isPublished: !a.isPublished } : x)),
      );
      flash(a.isPublished ? 'Unpublished.' : 'Published.');
    } catch (err) {
      flash(getApiErrorMessage(err) || 'Failed to update publish state.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAnnouncement(deleteTarget.id);
      setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      flash('Announcement deleted.');
    } catch (err) {
      flash(getApiErrorMessage(err) || 'Failed to delete the announcement.');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const isExpired = (a: Announcement) =>
    a.expiresAt != null && new Date(a.expiresAt).getTime() < Date.now();

  return (
    <div className="space-y-6">
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

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage/5 border border-sage/10">
            <Megaphone className="h-5 w-5 text-sage" />
          </div>
          <div>
            <h2 className="text-display-thin text-xl text-ink">Announcements</h2>
            <p className="text-xs text-ink-soft">
              Members see published announcements at /members/announcements
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="cta-primary text-sm px-5 py-2.5 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Announcement</span>
        </button>
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

      {/* Create / edit form */}
      <AnimatePresence>
        {form && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="luxury-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-display-thin text-lg text-ink">
                  {form.id ? 'Edit Announcement' : 'New Announcement'}
                </h3>
                <button
                  onClick={() => setForm(null)}
                  className="p-1 rounded-lg hover:bg-cream transition-colors"
                >
                  <X className="h-5 w-5 text-ink-soft" />
                </button>
              </div>

              <div>
                <label className="form-label">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Build week schedule posted"
                  maxLength={200}
                  className="form-input w-full"
                />
              </div>

              <div>
                <label className="form-label">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="The announcement body shown to members."
                  rows={5}
                  maxLength={10000}
                  className="form-input w-full"
                />
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="form-label">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value as AnnouncementPriority })
                    }
                    className="form-input w-auto min-w-[130px]"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0) + p.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Expires (optional)</label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="form-input w-auto"
                  />
                </div>
                <label className="flex items-center gap-2 pb-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                    className="h-4 w-4 rounded border-tan/40 text-sage focus:ring-sage/30"
                  />
                  <span className="text-sm text-ink">Published</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setForm(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim() || !form.content.trim()}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {form.id ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Loading announcements...</p>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No Announcements"
          description="Create the first announcement — members will see it on their announcements page."
          action={{ label: 'New Announcement', onClick: openCreate }}
        />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="luxury-card p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-medium text-ink truncate">{a.title}</h3>
                    <PriorityBadge priority={a.priority} />
                    {!a.isPublished && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-tan/20 text-ink-soft border border-tan/30">
                        Draft
                      </span>
                    )}
                    {isExpired(a) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-error/10 text-error border border-error/20">
                        Expired
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-soft line-clamp-2 whitespace-pre-line">
                    {a.content}
                  </p>
                  <p className="text-[11px] text-ink-soft/70 mt-2">
                    {a.author ? `${a.author.name} · ` : ''}
                    {new Date(a.createdAt).toLocaleDateString()}
                    {a.expiresAt && ` · expires ${new Date(a.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => handleTogglePublish(a)}
                    disabled={togglingId === a.id}
                    title={a.isPublished ? 'Unpublish' : 'Publish'}
                    className="p-2 rounded-lg border border-tan/40 text-ink-soft hover:bg-cream disabled:opacity-50 transition-colors"
                  >
                    {togglingId === a.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : a.isPublished ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    title="Edit"
                    className="p-2 rounded-lg border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(a)}
                    title="Delete"
                    className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message={`Delete "${deleteTarget?.title ?? ''}"? Members will no longer see it. This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        variant="danger"
      />
    </div>
  );
}
