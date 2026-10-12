'use client';

import { useState } from 'react';
import { FileUp, X, Loader2, Copy, Check } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { unpackSdr, uniqueLabels } from '../../lib/sdr-unpack';

interface Props {
  seasonId: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const MAX_DIM = 2400;
const TARGET_QUALITY = 0.82;

interface RasterResult {
  dataUrl: string;
  area: number;
  width: number;
  height: number;
}

/** Decode an embedded raster, downscale to MAX_DIM, return a compressed JPEG data URL + dims. */
function compressRaster(bytes: Uint8Array, mime: string): Promise<RasterResult> {
  // Copy into a fresh ArrayBuffer-backed view so it satisfies the strict BlobPart type.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(new Blob([copy], { type: mime }));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        return reject(new Error('Canvas unavailable'));
      }
      ctx.drawImage(img, 0, 0, w, h);
      const result = { dataUrl: canvas.toDataURL('image/jpeg', TARGET_QUALITY), area: img.width * img.height, width: img.width, height: img.height };
      URL.revokeObjectURL(blobUrl);
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Could not decode embedded image'));
    };
    img.src = blobUrl;
  });
}

interface Parsed {
  labels: string[];
  rasterCount: number;
  background: RasterResult | null;
}

/**
 * Imports a SmartDraw `.sdr` file. We can't edit SmartDraw's binary geometry,
 * so this brings the map in as editable native content the practical way:
 * the embedded rendered map becomes a tracing background, and the recovered
 * text labels (member rosters, structure names) are surfaced for placement.
 */
export function SdrImportModal({ seasonId, open, onClose, onImported }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [copied, setCopied] = useState(false);

  const upsert = trpc.lodging.upsertConfig.useMutation({
    onSuccess: () => {
      onImported();
      onClose();
    },
    onError: (e) => setErr(e.message),
  });

  if (!open) return null;

  const reset = () => {
    setParsed(null);
    setErr(null);
    setCopied(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    reset();
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const unpacked = await unpackSdr(bytes);
      // Pick the largest embedded raster (skip thumbnails) as the backdrop.
      let background: RasterResult | null = null;
      for (const ras of unpacked.rasters) {
        if (ras.mime === 'application/octet-stream') continue;
        try {
          const r = await compressRaster(ras.bytes, ras.mime);
          if (!background || r.area > background.area) background = r;
        } catch {
          /* skip undecodable raster */
        }
      }
      setParsed({
        labels: uniqueLabels(unpacked.labels),
        rasterCount: unpacked.rasters.length,
        background,
      });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not read .sdr file');
    } finally {
      setBusy(false);
    }
  };

  const handleSetBackground = () => {
    if (!parsed?.background) return;
    upsert.mutate({
      seasonId,
      backgroundUrl: parsed.background.dataUrl,
      backgroundOpacity: 0.5,
      backgroundScale: 1,
      backgroundX: 0,
      backgroundY: 0,
    });
  };

  const handleCopyRoster = async () => {
    if (!parsed?.labels.length) return;
    try {
      await navigator.clipboard.writeText(parsed.labels.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErr('Clipboard unavailable');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="luxury-card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-ink inline-flex items-center gap-2">
            <FileUp className="w-5 h-5 text-gold" />
            Import SmartDraw (.sdr)
          </h2>
          <button onClick={onClose} className="text-ink/60 hover:text-ink" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-ink/70 mb-3">
          Bring an existing SmartDraw map in to trace over. We pull the rendered map out of the
          file as a reference background and recover its labels (member names, structures) so you
          can place native units on top.
        </p>

        <div>
          <label className="form-label">SmartDraw file</label>
          <input type="file" accept=".sdr" onChange={handleFile} disabled={busy} className="text-sm w-full" />
          {busy && (
            <div className="text-xs text-ink/60 mt-1 inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Reading file…
            </div>
          )}
        </div>

        {parsed && (
          <div className="mt-4 space-y-4">
            {parsed.background ? (
              <div>
                <div className="text-caption text-sage mb-1">
                  Embedded map · {parsed.background.width}×{parsed.background.height}px
                </div>
                <img
                  src={parsed.background.dataUrl}
                  alt="Embedded SmartDraw map"
                  className="max-w-full max-h-48 border border-warm-border rounded"
                />
              </div>
            ) : (
              <div className="text-sm text-ink/60">
                No embedded map image found in this file{parsed.rasterCount ? ' (only a thumbnail)' : ''}.
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-caption text-sage">
                  {parsed.labels.length} labels recovered
                </span>
                {parsed.labels.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyRoster}
                    className="text-xs text-ink/70 hover:text-ink inline-flex items-center gap-1"
                    title="Copy all labels (one per line) for CSV import / reference"
                  >
                    {copied ? <Check className="w-3 h-3 text-sage" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy roster'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border border-warm-border rounded p-2 bg-cream/40">
                {parsed.labels.length === 0 && <span className="text-xs text-ink/50">No text labels found.</span>}
                {parsed.labels.map((l) => (
                  <span key={l} className="text-xs px-1.5 py-0.5 bg-sage/10 text-ink rounded border border-sage/20">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {err && <div className="mt-3 text-sm text-red-700">{err}</div>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="cta-secondary text-sm px-3 py-1.5">Cancel</button>
          <button
            onClick={handleSetBackground}
            disabled={!parsed?.background || upsert.isPending}
            className="cta-primary text-sm px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Use map as background
          </button>
        </div>
      </div>
    </div>
  );
}
