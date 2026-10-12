'use client';

import { useState, useEffect } from 'react';
import { ImagePlus, X, Loader2, Trash2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';

interface Props {
  seasonId: string;
  open: boolean;
  initial: {
    url: string | null;
    opacity: number;
    scale: number;
    x: number;
    y: number;
  };
  onClose: () => void;
  onSaved: () => void;
}

const MAX_DIM = 2400; // resize uploads larger than this dimension
const TARGET_QUALITY = 0.82; // JPEG quality for compressed output

/**
 * Optional one-click reference layers for neighbouring camps. Each entry loads
 * a hosted image as the reference background at a sensible default opacity;
 * the planner then scales / offsets it to sit against the edge that camp
 * borders. Empty by default; add `{ label, url, opacity }` entries to offer
 * presets.
 */
const REFERENCE_PRESETS: { label: string; url: string; opacity: number }[] = [];

/**
 * Compresses a File to a JPEG data URL via canvas. Resizes so the larger
 * dimension is at most MAX_DIM. Keeps the file under ~1.5 MB for typical
 * layout screenshots.
 */
function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', TARGET_QUALITY));
      };
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function BackgroundImageModal({ seasonId, open, initial, onClose, onSaved }: Props) {
  const [url, setUrl] = useState<string | null>(initial.url);
  const [opacity, setOpacity] = useState(initial.opacity);
  const [scale, setScale] = useState(initial.scale);
  const [x, setX] = useState(initial.x);
  const [y, setY] = useState(initial.y);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl(initial.url);
      setOpacity(initial.opacity);
      setScale(initial.scale);
      setX(initial.x);
      setY(initial.y);
      setErr(null);
    }
  }, [open, initial.url, initial.opacity, initial.scale, initial.x, initial.y]);

  const upsert = trpc.lodging.upsertConfig.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  if (!open) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setUrl(dataUrl);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    upsert.mutate({
      seasonId,
      backgroundUrl: url,
      backgroundOpacity: opacity,
      backgroundScale: scale,
      backgroundX: x,
      backgroundY: y,
    });
  };

  const handleRemove = () => {
    setUrl(null);
    upsert.mutate({ seasonId, backgroundUrl: null });
  };

  const sizeKb = url ? Math.round((url.length * 0.75) / 1024) : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="luxury-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-ink inline-flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-gold" />
            Reference background
          </h2>
          <button onClick={onClose} className="text-ink/60 hover:text-ink" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-ink/70 mb-3">
          Drop a screenshot or export of a prior-year layout (or any reference image). It will
          render semi-transparent under the grid so you can place this year's units on top.
          Large images are auto-resized to {MAX_DIM}px max.
        </p>

        <div className="space-y-4">
          {REFERENCE_PRESETS.length > 0 && (
            <div>
              <label className="form-label">Neighbour maps</label>
              <div className="flex flex-wrap gap-2">
                {REFERENCE_PRESETS.map((p) => {
                  const active = url === p.url;
                  return (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => {
                        setUrl(p.url);
                        setOpacity(p.opacity);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border rounded hover:bg-cream/60 text-ink ${
                        active ? 'border-gold/70 bg-gold/5' : 'border-warm-border'
                      }`}
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      {p.label}
                      {active ? ' ✓' : ''}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs text-ink/50 mt-1">
                Loads a neighbour camp's map as a reference layer. Then set Scale and Offset X/Y
                below to slide it to the edge they border, and Save.
              </div>
            </div>
          )}

          <div>
            <label className="form-label">Image file</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              disabled={busy}
              className="text-sm w-full"
            />
            {busy && (
              <div className="text-xs text-ink/60 mt-1 inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Compressing…
              </div>
            )}
            {url && (
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-ink/60">
                <span>Loaded · {sizeKb} KB</span>
                <button
                  type="button"
                  onClick={() => setUrl(null)}
                  className="text-red-700 hover:underline inline-flex items-center gap-0.5"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
            )}
            {url && (
              <img
                src={url}
                alt="Background preview"
                className="mt-2 max-w-full max-h-40 border border-warm-border rounded"
              />
            )}
          </div>

          <div>
            <label className="form-label">Opacity ({Math.round(opacity * 100)}%)</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="form-label">Scale ({scale.toFixed(2)}×)</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-ink/50 mt-0.5">
              Tip: scale until the image matches your unit grid (e.g. a 100ft camp width should span
              ~100ft on the canvas).
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Offset X (ft)</label>
              <input
                type="number"
                step="1"
                value={x}
                onChange={(e) => setX(Number(e.target.value) || 0)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Offset Y (ft)</label>
              <input
                type="number"
                step="1"
                value={y}
                onChange={(e) => setY(Number(e.target.value) || 0)}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {err && <div className="mt-3 text-sm text-red-700">{err}</div>}

        <div className="mt-5 flex items-center justify-between gap-2">
          {initial.url && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={upsert.isPending}
              className="text-sm text-red-700 hover:underline inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove background
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="cta-secondary text-sm px-3 py-1.5">Cancel</button>
            <button
              onClick={handleSave}
              disabled={busy || upsert.isPending}
              className="cta-primary text-sm px-3 py-1.5 inline-flex items-center gap-1.5"
            >
              {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
