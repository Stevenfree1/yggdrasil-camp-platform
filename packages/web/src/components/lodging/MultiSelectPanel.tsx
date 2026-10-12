'use client';

import { Copy, Trash2, X, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';

type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

interface Props {
  count: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlign: (mode: AlignMode) => void;
  onReorder: (dir: 'front' | 'back') => void;
  onClose: () => void;
}

/** Properties panel shown when more than one unit is selected. */
export function MultiSelectPanel({ count, onDuplicate, onDelete, onAlign, onReorder, onClose }: Props) {
  const alignBtn = (mode: AlignMode, label: string) => (
    <button
      type="button"
      onClick={() => onAlign(mode)}
      className="px-2 py-1 text-xs border border-warm-border rounded text-ink hover:bg-cream/60"
    >
      {label}
    </button>
  );

  return (
    <aside className="luxury-card p-4 h-fit sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-ink">{count} units selected</h3>
        <button type="button" onClick={onClose} className="text-ink/60 hover:text-ink" aria-label="Clear selection">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-ink/60 mb-3">
        Drag any selected unit to move the whole group, or use the arrow keys to nudge (Shift = 10 ft).
      </p>

      <div className="space-y-4 text-sm">
        <div>
          <label className="form-label">Align</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {alignBtn('left', 'Left')}
            {alignBtn('hcenter', 'Center')}
            {alignBtn('right', 'Right')}
            {alignBtn('top', 'Top')}
            {alignBtn('vcenter', 'Middle')}
            {alignBtn('bottom', 'Bottom')}
          </div>
        </div>

        <div>
          <label className="form-label">Layer</label>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => onReorder('front')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded text-ink hover:bg-cream/60"
            >
              <ArrowUpToLine className="w-3.5 h-3.5" /> Front
            </button>
            <button
              type="button"
              onClick={() => onReorder('back')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded text-ink hover:bg-cream/60"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" /> Back
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-warm-border flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded text-ink hover:bg-cream/60"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate all
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-red-300 rounded text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete all
          </button>
        </div>
      </div>
    </aside>
  );
}
