'use client';

import React from 'react';
import { M, UI_FONT, polar, dialTicks } from './medallion';

interface Props {
  /** Screen corner to pin to. */
  corner: 'top-right' | 'bottom-left';
  /** Small caps caption under the disc. */
  caption: string;
  /** Optional second caption line. */
  subCaption?: string;
  /**
   * Optional raster instrument plate drawn as the disc itself (a generated
   * astrolabe-style plate). When set, the hand-drawn rim/bezel/notch chrome
   * is skipped — the plate carries the ornament — and children draw over its
   * quiet parchment field. The drawn parchment circle stays underneath as the
   * graceful fallback while the image loads (or if it ever 404s).
   */
  plateSrc?: string;
  /** SVG content drawn inside the bezel, in a -100..100 viewBox. */
  children: React.ReactNode;
  ariaLabel: string;
}

const RIM = 80;
const BEZEL = 70;
/**
 * The plate raster's ornamental band was lovely but ate a quarter of the
 * radius, so the disc now shows ONLY the plate's parchment field: the image
 * is scaled up until its field edge (0.746 of the bitmap radius, measured
 * from source pixels) lands on DISC_R, and a circular clip discards the band
 * entirely. A thin drawn gold rim replaces the band's framing job.
 */
const DISC_R = 92;
const PLATE_R = DISC_R / 0.746; // ≈123.3 — field edge lands exactly on the clip

/**
 * The shared instrument frame the overlay medallions sit in — parchment disc,
 * gold rim, sage bezel with ornamental notches, warm drop shadow (or, with
 * `plateSrc`, a generated astrolabe plate in place of the drawn chrome).
 *
 * Note the `!absolute`: `.admin-ledger .luxury-card > *` forces position:relative
 * on direct children, which would otherwise flatten these into the layout.
 */
export function MapMedallion({ corner, caption, subCaption, plateSrc, children, ariaLabel }: Props) {
  const place = corner === 'top-right' ? 'top-3 right-3' : 'bottom-3 left-3';
  return (
    <div className={`!absolute ${place} !z-10 pointer-events-none select-none flex flex-col items-center gap-1`}>
      <svg
        width={204}
        height={204}
        viewBox="-100 -100 200 200"
        role="img"
        aria-label={ariaLabel}
        style={{
          filter: 'drop-shadow(0 6px 16px rgba(44, 36, 22, 0.22))',
          // A working overlay, not a poster: let the map read through it.
          opacity: 0.92,
        }}
      >
        {plateSrc ? (
          <>
            <defs>
              <clipPath id="mm-disc">
                <circle r={DISC_R} />
              </clipPath>
            </defs>
            {/* translucent fallback ground, then the plate's parchment field —
                scaled so the ornamental band falls outside the clip; itself
                translucent so the map grid ghosts through */}
            <circle r={DISC_R} fill={M.parchment} fillOpacity={0.35} />
            <image
              href={plateSrc}
              x={-PLATE_R}
              y={-PLATE_R}
              width={PLATE_R * 2}
              height={PLATE_R * 2}
              opacity={0.76}
              clipPath="url(#mm-disc)"
            />
            {/* thin engraved rim in place of the discarded band */}
            <circle r={DISC_R} fill="none" stroke={M.goldDeep} strokeWidth={1.4} opacity={0.9} />
            <circle r={DISC_R - 2.5} fill="none" stroke={M.gold} strokeWidth={0.5} opacity={0.6} />
          </>
        ) : (
          <>
            {/* parchment ground + rim */}
            <circle r={RIM} fill={M.parchment} fillOpacity={0.95} stroke={M.gold} strokeWidth={1} />
            <circle r={RIM - 3} fill="none" stroke={M.gold} strokeWidth={0.4} opacity={0.55} />
            <circle r={BEZEL} fill="none" stroke={M.sage} strokeWidth={1.1} opacity={0.85} />
            {/* ornamental bezel notches */}
            {dialTicks(30).map(({ angle, cardinal }) => {
              const [x1, y1] = polar(angle, cardinal ? BEZEL - 4 : BEZEL);
              const [x2, y2] = polar(angle, RIM - 4);
              return (
                <line
                  key={angle}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={cardinal ? M.goldDeep : M.sage}
                  strokeWidth={cardinal ? 1.6 : 0.9}
                  opacity={cardinal ? 0.85 : 0.5}
                />
              );
            })}
          </>
        )}
        {children}
      </svg>
      <div
        className="text-center leading-tight"
        style={{ fontFamily: UI_FONT, marginTop: -6 }}
      >
        <div style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: M.ink, opacity: 0.85, fontWeight: 600 }}>
          {caption}
        </div>
        {subCaption && (
          <div style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: M.ink, opacity: 0.55 }}>
            {subCaption}
          </div>
        )}
      </div>
    </div>
  );
}
