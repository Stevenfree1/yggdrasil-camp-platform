// Composes a polished, shareable PNG from a rendered lodging-map image:
// a titled header, a legend of item kinds, and a scale bar. Browser-only.

export interface ExportLegendItem {
  label: string;
  color: string;
  /** Silhouette hint so near-identical canvas colours stay tellable apart. */
  shape?: 'rect' | 'hexagon' | 'triangle' | 'trefoil' | 'round';
}

export type MapExportScope = 'camp' | 'full';

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface ExportUnitBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Width of street ribbons drawn around a map edge. */
export const MAP_STREET_WIDTH_FT = 16;

/**
 * Exact world-space crop used by the two map downloads.
 *
 * Camp only is deliberately anchored to the surveyed site frame and only its
 * configured adjacent streets. Full map unions that frame with every unit and
 * the contextual background (the Gs/partner camp map, including distant F).
 */
export function getMapExportBounds(
  scope: MapExportScope,
  site: {
    widthFt: number;
    depthFt: number;
    streetTop?: boolean;
    streetBottom?: boolean;
    streetRight?: boolean;
  } | null,
  units: ExportUnitBounds[],
  background: WorldBounds | null,
): WorldBounds | null {
  const bounds: WorldBounds[] = [];

  if (site) {
    const campPadFt = scope === 'camp' ? 2 : 0;
    bounds.push({
      minX: scope === 'camp' ? -campPadFt : 0,
      minY: site.streetTop ? -MAP_STREET_WIDTH_FT - campPadFt : 0,
      maxX: site.widthFt + (site.streetRight ? MAP_STREET_WIDTH_FT + campPadFt : 0),
      // With no street on the camp's back edge, stop exactly at the boundary.
      // Neighboring reference objects begin at that same Y coordinate, so even a
      // 2 ft export pad would leak their fire lane into the camp-only download.
      maxY: site.depthFt + (site.streetBottom ? MAP_STREET_WIDTH_FT + campPadFt : 0),
    });
  }

  // Without a surveyed frame, camp-only falls back to the camp objects. With
  // a frame, the crop stays exact so outlying reference objects cannot leak in.
  if (scope === 'full' || !site) {
    bounds.push(
      ...units.map((u) => ({ minX: u.x, minY: u.y, maxX: u.x + u.w, maxY: u.y + u.h })),
    );
  }
  if (scope === 'full' && background) bounds.push(background);
  if (bounds.length === 0) return null;

  const padFt = scope === 'camp' && site ? 0 : 8;
  return {
    minX: Math.min(...bounds.map((b) => b.minX)) - padFt,
    minY: Math.min(...bounds.map((b) => b.minY)) - padFt,
    maxX: Math.max(...bounds.map((b) => b.maxX)) + padFt,
    maxY: Math.max(...bounds.map((b) => b.maxY)) + padFt,
  };
}

export interface ExportOptions {
  title: string;
  subtitle: string;
  legend: ExportLegendItem[];
  /** Pixels per foot in the supplied map image (drives the scale bar). */
  pxPerFt: number;
  /**
   * True bearing (deg) the top of the map faces. Draws a north arrow and the
   * prevailing-wind note — a shared map with no orientation on it is a map you
   * cannot act on.
   */
  frontageBearing?: number | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load map image for export'));
    img.src = src;
  });
}

/** Round to a friendly 1 / 2 / 5 × 10ⁿ value for the scale bar. */
function niceRound(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return nice * pow;
}

/** Draw a legend swatch with a silhouette hint. */
function drawSwatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  shape: ExportLegendItem['shape'],
) {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#2C241659';
  ctx.lineWidth = Math.max(1, size * 0.06);
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  ctx.beginPath();
  if (shape === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'triangle') {
    ctx.moveTo(cx, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x, y + size);
    ctx.closePath();
  } else if (shape === 'round') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (shape === 'trefoil') {
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2 - Math.PI / 2;
      const rr = r * (0.8 + 0.2 * Math.cos(3 * (t + Math.PI / 2)));
      const px = cx + rr * Math.cos(t);
      const py = cy + rr * Math.sin(t);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    ctx.rect(x, y, size, size);
  }
  ctx.fill();
  ctx.stroke();
}

/** North arrow + prevailing-wind note, drawn into the export header. */
function drawCompass(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  bearing: number,
) {
  const rad = (deg: number) => ((deg - bearing) * Math.PI) / 180;
  const pt = (deg: number, rr: number): [number, number] => [
    cx + rr * Math.sin(rad(deg)),
    cy - rr * Math.cos(rad(deg)),
  ];
  ctx.save();
  ctx.strokeStyle = '#4A5D5A';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // north needle
  const [nx, ny] = pt(0, r * 0.78);
  ctx.strokeStyle = '#2C2416';
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.stroke();
  ctx.fillStyle = '#2C2416';
  ctx.font = `bold ${Math.round(r * 0.62)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const [lx, ly] = pt(0, r * 1.24);
  ctx.fillText('N', lx, ly);

  // prevailing wind, from the SW-W sector
  const [wx, wy] = pt(235, r * 1.05);
  const [wx2, wy2] = pt(235, r * 0.42);
  ctx.strokeStyle = '#A14E2E';
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(wx2, wy2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(wx2, wy2, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function composeMapExport(mapDataUrl: string, opts: ExportOptions): Promise<string> {
  const img = await loadImage(mapDataUrl);
  const W = img.width;
  const H = img.height;
  const s = Math.max(0.6, W / 1600); // scale type/padding to the image resolution

  const pad = Math.round(36 * s);
  const titleSize = Math.round(38 * s);
  const subSize = Math.round(22 * s);
  const headerH = pad + titleSize + Math.round(8 * s) + subSize + pad;

  const swatch = Math.round(22 * s);
  const legendFont = Math.round(20 * s);
  const itemGap = Math.round(26 * s);
  const rowGap = Math.round(14 * s);
  const labelGap = Math.round(8 * s);

  // Measure + pack the legend into rows to size the footer.
  const measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) throw new Error('Canvas unavailable');
  measureCtx.font = `${legendFont}px Inter, sans-serif`;
  const itemWidths = opts.legend.map(
    (it) => swatch + labelGap + measureCtx.measureText(it.label).width + itemGap,
  );
  const innerW = W - 2 * pad;
  let rows = opts.legend.length ? 1 : 0;
  let rowW = 0;
  for (const w of itemWidths) {
    if (rowW + w > innerW && rowW > 0) {
      rows++;
      rowW = 0;
    }
    rowW += w;
  }
  const legendH = rows * (swatch + rowGap);
  const scaleBarH = Math.round(36 * s);
  const footerH = pad + legendH + Math.round(16 * s) + scaleBarH + pad;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = headerH + H + footerH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // Background.
  ctx.fillStyle = '#FAF7F2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header.
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#2C2416';
  ctx.font = `bold ${titleSize}px Inter, sans-serif`;
  ctx.fillText(opts.title, pad, pad);
  ctx.fillStyle = '#4A5D5A';
  ctx.font = `${subSize}px Inter, sans-serif`;
  ctx.fillText(opts.subtitle, pad, pad + titleSize + Math.round(8 * s));
  if (opts.frontageBearing != null) {
    const cr = Math.round(26 * s);
    const ccx = W - pad - cr * 1.4;
    const ccy = pad + cr * 1.1;
    drawCompass(ctx, ccx, ccy, cr, opts.frontageBearing);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#A14E2E';
    ctx.font = `${Math.round(15 * s)}px Inter, sans-serif`;
    ctx.fillText('prevailing wind SW–W', W - pad, ccy + cr * 1.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = Math.max(1, 2 * s);
  ctx.beginPath();
  ctx.moveTo(pad, headerH - Math.round(pad / 2));
  ctx.lineTo(W - pad, headerH - Math.round(pad / 2));
  ctx.stroke();

  // Map.
  ctx.drawImage(img, 0, headerH);

  // Legend.
  ctx.textBaseline = 'middle';
  ctx.font = `${legendFont}px Inter, sans-serif`;
  let lx = pad;
  let ly = headerH + H + pad;
  for (let i = 0; i < opts.legend.length; i++) {
    const it = opts.legend[i];
    if (lx + itemWidths[i] > W - pad && lx > pad) {
      lx = pad;
      ly += swatch + rowGap;
    }
    drawSwatch(ctx, lx, ly, swatch, it.color, it.shape);
    ctx.fillStyle = '#2C2416';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.label, lx + swatch + labelGap, ly + swatch / 2);
    lx += itemWidths[i];
  }

  // Scale bar (bottom-left of the footer).
  const barY = canvas.height - pad - Math.round(scaleBarH / 2);
  const targetPx = Math.min(W * 0.25, 260 * s);
  const barFt = niceRound(targetPx / Math.max(opts.pxPerFt, 0.0001));
  const barPx = barFt * opts.pxPerFt;
  const tick = Math.round(6 * s);
  ctx.strokeStyle = '#2C2416';
  ctx.lineWidth = Math.max(2, 3 * s);
  ctx.beginPath();
  ctx.moveTo(pad, barY);
  ctx.lineTo(pad + barPx, barY);
  ctx.moveTo(pad, barY - tick);
  ctx.lineTo(pad, barY + tick);
  ctx.moveTo(pad + barPx, barY - tick);
  ctx.lineTo(pad + barPx, barY + tick);
  ctx.stroke();
  ctx.fillStyle = '#2C2416';
  ctx.font = `${Math.round(18 * s)}px Inter, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(`${barFt} ft`, pad + barPx + Math.round(10 * s), barY);

  return canvas.toDataURL('image/png');
}
