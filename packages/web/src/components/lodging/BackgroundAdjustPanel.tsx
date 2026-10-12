'use client';

import { Move, X, Loader2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';

export interface BackgroundPlacement {
  opacity: number;
  scale: number;
  x: number;
  y: number;
  /** Degrees clockwise about the image centre. */
  rotation: number;
}

interface Props {
  value: BackgroundPlacement;
  onChange: (patch: Partial<BackgroundPlacement>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  dirty: boolean;
}

/** One nudge of the arrow pad, in feet. Shift-click multiplies by COARSE_STEP. */
const NUDGE_FT = 1;
const COARSE_MULT = 10;

/**
 * Live placement controls for the reference background, floating over the
 * canvas rather than sitting in a modal. Lining a neighbour camp's map up with
 * our own units is a visual judgement — it needs the map visible while the
 * numbers change, which a modal cannot give.
 *
 * Position is normally set by dragging the image itself; this panel owns scale
 * and opacity, and offers an arrow pad for the last foot or two of precision.
 */
export function BackgroundAdjustPanel({ value, onChange, onSave, onCancel, saving, dirty }: Props) {
  const nudge = (dx: number, dy: number, coarse: boolean) => {
    const step = NUDGE_FT * (coarse ? COARSE_MULT : 1);
    onChange({
      x: Math.round((value.x + dx * step) * 100) / 100,
      y: Math.round((value.y + dy * step) * 100) / 100,
    });
  };

  const arrowClass =
    'inline-flex items-center justify-center w-7 h-7 border border-warm-border rounded hover:bg-cream/60 text-ink';

  return (
    // top-left is the one free corner: wind/sun sits top-right, the power card
    // bottom-right, the mini-map bottom-left.
    <div className="!absolute !z-10 top-3 left-3 w-64 luxury-card p-3 shadow-lg bg-cream/95 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-sm text-ink inline-flex items-center gap-1.5">
          <Move className="w-4 h-4 text-gold" />
          Position background
        </h3>
        <button onClick={onCancel} className="text-ink/60 hover:text-ink" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-ink/60 mb-3 leading-snug">
        Drag the image on the map to move it. Use Scale to match its feet to ours.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-ink/70 font-medium">
            Scale ({value.scale.toFixed(3)}×)
          </label>
          <input
            type="range"
            min="0.05"
            max="3"
            step="0.005"
            value={value.scale}
            onChange={(e) => onChange({ scale: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex items-center gap-1 mt-1">
            {[-0.01, -0.001, 0.001, 0.01].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  onChange({
                    scale: Math.max(0.05, Math.round((value.scale + d) * 1000) / 1000),
                  })
                }
                className="flex-1 px-1 py-0.5 text-[11px] border border-warm-border rounded hover:bg-cream/60 text-ink tabular-nums"
              >
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </div>

        {/* Aerial photos are never shot square to the frontage, so rotation is
            what makes one usable at all — coarse buttons for the quarter turn,
            slider and fine steps for the last few degrees. */}
        <div>
          <label className="text-xs text-ink/70 font-medium">
            Rotation ({value.rotation.toFixed(1)}°)
          </label>
          <input
            type="range"
            min="-180"
            max="180"
            step="0.5"
            value={value.rotation}
            onChange={(e) => onChange({ rotation: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex items-center gap-1 mt-1">
            {[-90, -1, -0.1, 0.1, 1, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const next = value.rotation + d;
                  // keep it in -180..180 so the slider always shows the handle
                  const wrapped = ((((next + 180) % 360) + 360) % 360) - 180;
                  onChange({ rotation: Math.round(wrapped * 10) / 10 });
                }}
                className="flex-1 px-0.5 py-0.5 text-[11px] border border-warm-border rounded hover:bg-cream/60 text-ink tabular-nums"
              >
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-ink/70 font-medium">
            Opacity ({Math.round(value.opacity * 100)}%)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={value.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
            className="w-full"
          />
        </div>

        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              className={arrowClass}
              onClick={(e) => nudge(0, -1, e.shiftKey)}
              title="Nudge up (Shift = 10 ft)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <div className="flex gap-1">
              <button
                type="button"
                className={arrowClass}
                onClick={(e) => nudge(-1, 0, e.shiftKey)}
                title="Nudge left (Shift = 10 ft)"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className={arrowClass}
                onClick={(e) => nudge(1, 0, e.shiftKey)}
                title="Nudge right (Shift = 10 ft)"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              className={arrowClass}
              onClick={(e) => nudge(0, 1, e.shiftKey)}
              title="Nudge down (Shift = 10 ft)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-1.5">
            <label className="block">
              <span className="text-[11px] text-ink/60">X (ft)</span>
              <input
                type="number"
                step="1"
                value={value.x}
                onChange={(e) => onChange({ x: Number(e.target.value) || 0 })}
                className="form-input !py-1 !text-xs tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink/60">Y (ft)</span>
              <input
                type="number"
                step="1"
                value={value.y}
                onChange={(e) => onChange({ y: Number(e.target.value) || 0 })}
                className="form-input !py-1 !text-xs tabular-nums"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="cta-secondary text-xs px-2.5 py-1.5 inline-flex items-center gap-1"
          title="Discard changes and restore the saved placement"
        >
          <RotateCcw className="w-3 h-3" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="cta-primary text-xs px-2.5 py-1.5 ml-auto inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {dirty ? 'Save placement' : 'Saved'}
        </button>
      </div>
    </div>
  );
}
