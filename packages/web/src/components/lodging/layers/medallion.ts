/**
 * Shared geometry + tokens for the map's overlay medallions (compass, mini-map).
 * Pure functions — no React, no Konva.
 */

/** Camp palette, mirrored from globals.css so SVG can use literal values. */
export const M = {
  ink: '#2C2416',
  sage: '#4A5D5A',
  tan: '#D4C4A8',
  gold: '#D4AF37',
  goldDeep: '#B8942C',
  cream: '#FAF7F2',
  parchment: '#F2E8D8',
  sienna: '#A14E2E',
} as const;

export const DISPLAY_FONT = 'var(--font-playfair), "Playfair Display", Georgia, serif';
export const UI_FONT = 'var(--font-inter), Inter, system-ui, sans-serif';

/** Point at `r` along a map-space angle (0 = up/map-north, clockwise). */
export function polar(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

/**
 * Map-space angle for a TRUE azimuth, given the true bearing that map-up faces.
 * (Camp frontage bearing comes from SeasonMapConfig.frontageBearing.)
 */
export function azToMap(azimuth: number, bearing: number): number {
  return azimuth - bearing;
}

/**
 * An n-pointed star polygon (default 8 — the eight-point
 * motif used as the compass rose), as an SVG points string centred on 0,0.
 */
export function starPoints(outerR: number, innerR: number, points = 8, rotationDeg = 0): string {
  const verts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const [x, y] = polar(rotationDeg + (i * 180) / points, r);
    verts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return verts.join(' ');
}

/** Tick angles around a dial: every `stepDeg`, flagged as cardinal every 90°. */
export function dialTicks(stepDeg = 15): { angle: number; cardinal: boolean }[] {
  const ticks: { angle: number; cardinal: boolean }[] = [];
  for (let a = 0; a < 360; a += stepDeg) ticks.push({ angle: a, cardinal: a % 90 === 0 });
  return ticks;
}

/** Perceptual-ish luminance test, for choosing readable label ink on a fill. */
export function isDarkHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.55;
}
