'use client';

import { Trash2, X, Copy, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import { EditorUnit, LodgingUnitKind, KIND_LABELS, ITEM_DEFS } from './types';

interface Props {
  unit: EditorUnit;
  onChange: (patch: Partial<EditorUnit>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReorder: (dir: 'front' | 'back') => void;
  onClose: () => void;
  occupants: Array<{ id: string; name: string; playaName: string | null }>;
  assignmentSlot?: React.ReactNode;
}

// Kind options, derived from the catalog so new item types appear automatically.
const KINDS: LodgingUnitKind[] = ITEM_DEFS.map((d) => d.kind);

export function UnitPropertiesPanel({ unit, onChange, onDelete, onDuplicate, onReorder, onClose, occupants, assignmentSlot }: Props) {
  const numericPatch = (key: 'x' | 'y' | 'w' | 'h' | 'rotation') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (Number.isFinite(value)) onChange({ [key]: value });
  };

  return (
    <aside className="luxury-card p-4 h-fit sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-ink">Unit</h3>
        <button type="button" onClick={onClose} className="text-ink/60 hover:text-ink" aria-label="Close panel">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <label className="form-label">Kind</label>
          <select
            value={unit.kind}
            onChange={(e) => onChange({ kind: e.target.value as LodgingUnitKind })}
            className="form-input"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Label</label>
          <input
            type="text"
            value={unit.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value || null })}
            placeholder="(auto from occupants)"
            className="form-input"
          />
        </div>

        {(unit.kind === 'STRUCTURE' || unit.kind === 'BOUNDARY') && (
          <div>
            <label className="form-label">Partner Camp</label>
            <input
              type="text"
              value={unit.partnerCamp ?? ''}
              onChange={(e) => onChange({ partnerCamp: e.target.value || null })}
              placeholder="e.g. Main Dome, Neighbor Camp"
              className="form-input"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="form-label">Width (ft)</label>
            <input type="number" step="0.5" min="1" value={unit.w} onChange={numericPatch('w')} className="form-input" />
          </div>
          <div>
            <label className="form-label">Height (ft)</label>
            <input type="number" step="0.5" min="1" value={unit.h} onChange={numericPatch('h')} className="form-input" />
          </div>
          <div>
            <label className="form-label">X (ft)</label>
            <input type="number" step="0.5" value={unit.x} onChange={numericPatch('x')} className="form-input" />
          </div>
          <div>
            <label className="form-label">Y (ft)</label>
            <input type="number" step="0.5" value={unit.y} onChange={numericPatch('y')} className="form-input" />
          </div>
        </div>

        <div>
          <label className="form-label">Rotation ({unit.rotation.toFixed(0)}°)</label>
          <input
            type="range"
            min="-180"
            max="180"
            step="5"
            value={unit.rotation}
            onChange={numericPatch('rotation')}
            className="w-full"
          />
        </div>

        <div>
          <label className="form-label">Color override</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={unit.color ?? '#D4C4A8'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="w-10 h-8 cursor-pointer rounded border border-warm-border"
            />
            {unit.color && (
              <button
                type="button"
                onClick={() => onChange({ color: null })}
                className="text-xs text-ink/60 hover:text-ink underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="form-label">Opacity ({Math.round(unit.opacity * 100)}%)</label>
          <input
            type="range"
            min="0.15"
            max="1"
            step="0.05"
            value={unit.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
            className="w-full"
          />
          <div className="text-xs text-ink/50 mt-0.5">
            Lower it to let lower layers show through — e.g. a shade structure over the tents.
          </div>
        </div>

        <div>
          <label className="form-label">Notes</label>
          <textarea
            value={unit.notes ?? ''}
            onChange={(e) => onChange({ notes: e.target.value || null })}
            className="form-input min-h-[60px]"
            placeholder="Vendor, contingencies, etc."
          />
        </div>

        {assignmentSlot && (
          <div className="pt-3 border-t border-warm-border">{assignmentSlot}</div>
        )}

        {occupants.length > 0 && !assignmentSlot && (
          <div className="pt-3 border-t border-warm-border">
            <label className="form-label">Occupants</label>
            <ul className="text-sm text-ink/80 mt-1">
              {occupants.map((o) => (
                <li key={o.id}>{o.playaName ? `${o.playaName} (${o.name})` : o.name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-3 border-t border-warm-border space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDuplicate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded text-ink hover:bg-cream/60"
              title="Duplicate (Cmd+D)"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => onReorder('front')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded text-ink hover:bg-cream/60"
              title="Bring to front"
            >
              <ArrowUpToLine className="w-3.5 h-3.5" />
              Front
            </button>
            <button
              type="button"
              onClick={() => onReorder('back')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded text-ink hover:bg-cream/60"
              title="Send to back"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Back
            </button>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-red-300 rounded text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete unit
          </button>
        </div>
      </div>
    </aside>
  );
}
