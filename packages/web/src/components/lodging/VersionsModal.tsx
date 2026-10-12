'use client';

import { useState } from 'react';
import { History, X, Loader2, Save, RotateCcw, Trash2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';

interface Props {
  seasonId: string;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

/** Save / restore named snapshots of the current season's lodging map. */
export function VersionsModal({ seasonId, open, onClose, onRestored }: Props) {
  const [name, setName] = useState('');
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const utils = trpc.useContext();

  const versions = trpc.lodging.listVersions.useQuery({ seasonId }, { enabled: open });

  const saveVersion = trpc.lodging.saveVersion.useMutation({
    onSuccess: (v) => {
      setName('');
      setMsg(`Saved "${v.name}" (${v.unitCount} units).`);
      utils.lodging.listVersions.invalidate({ seasonId });
    },
    onError: (e) => setMsg(e.message),
  });
  const restoreVersion = trpc.lodging.restoreVersion.useMutation({
    onSuccess: (r) => {
      setConfirmRestore(null);
      setMsg(`Restored — ${r.updated} kept, ${r.created} re-added, ${r.deleted} removed.`);
      onRestored();
    },
    onError: (e) => setMsg(e.message),
  });
  const deleteVersion = trpc.lodging.deleteVersion.useMutation({
    onSuccess: () => utils.lodging.listVersions.invalidate({ seasonId }),
    onError: (e) => setMsg(e.message),
  });

  if (!open) return null;

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="luxury-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-ink inline-flex items-center gap-2">
            <History className="w-5 h-5 text-gold" />
            Map versions
          </h2>
          <button onClick={onClose} className="text-ink/60 hover:text-ink" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-ink/70 mb-3">
          Save a named snapshot of the current layout, then restore it later. Restoring keeps
          assignments on units that still exist in the snapshot.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Version name (e.g. 'Stacked v1')"
            className="form-input flex-1"
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) saveVersion.mutate({ seasonId, name: name.trim() });
            }}
          />
          <button
            type="button"
            onClick={() => saveVersion.mutate({ seasonId, name: name.trim() })}
            disabled={!name.trim() || saveVersion.isPending}
            className="cta-primary text-sm px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {saveVersion.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>

        {msg && <div className="text-xs text-sage mb-3">{msg}</div>}

        <div className="border-t border-warm-border pt-3">
          {versions.isLoading && (
            <div className="text-sm text-ink/60 inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          )}
          {versions.data && versions.data.length === 0 && (
            <div className="text-sm text-ink/50">No versions saved yet.</div>
          )}
          <ul className="space-y-2">
            {versions.data?.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 border border-warm-border rounded p-2">
                <div className="min-w-0">
                  <div className="text-sm text-ink truncate">{v.name}</div>
                  <div className="text-xs text-ink/50">{v.unitCount} units · {fmtDate(v.createdAt)}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {confirmRestore === v.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => restoreVersion.mutate({ versionId: v.id })}
                        disabled={restoreVersion.isPending}
                        className="text-xs px-2 py-1 rounded bg-gold/90 text-ink hover:bg-gold inline-flex items-center gap-1"
                      >
                        {restoreVersion.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRestore(null)}
                        className="text-xs px-2 py-1 rounded border border-warm-border text-ink hover:bg-cream/60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { setMsg(null); setConfirmRestore(v.id); }}
                        className="text-xs px-2 py-1 rounded border border-warm-border text-ink hover:bg-cream/60 inline-flex items-center gap-1"
                        title="Restore this version"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteVersion.mutate({ versionId: v.id })}
                        className="text-ink/40 hover:text-red-700"
                        title="Delete this version"
                        aria-label="Delete version"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
