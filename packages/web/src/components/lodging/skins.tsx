import React from 'react';
import { Rect, Line, Circle, Path, Arc, Text, Group } from 'react-konva';
import type Konva from 'konva';
import type { SkinId } from './catalog';
import {
  hatchSegment,
  hexagonPoints,
  trefoilPoints,
  insetPolygon,
  ribPositions,
  gridLinePositions,
  latticeCells,
  shadeHex,
  BOTEH_PATH,
} from './skin-geometry';

const NL = { listening: false } as const;

/** clipFunc tracing a flat [x0,y0,...] polygon, for skins that must not spill. */
export function polygonClip(points: number[]) {
  return (ctx: Konva.Context) => {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
  };
}

/**
 * Olive-tan corrugated 20-ft container. Ribs run transverse (across the short
 * axis, like real roof corrugation); doors sit on the far end of the long axis,
 * so unit rotation encodes door orientation.
 */
function containerSkin(w: number, h: number) {
  const horizontal = w >= h;
  const rib = Math.min(w, h) / 8;
  const cast = Math.min(w, h) * 0.14;
  const doorTicks = [0.2, 0.8];
  return (
    <>
      <Rect width={w} height={h} fill="#B7A268" stroke="#7A6B42" strokeWidth={1} {...NL} />
      {ribPositions(horizontal ? w : h, rib).map((p) => (
        <Line
          key={p}
          points={horizontal ? [p, 1.5, p, h - 1.5] : [1.5, p, w - 1.5, p]}
          stroke="#8F7F52"
          strokeWidth={0.8}
          opacity={0.7}
          {...NL}
        />
      ))}
      {[[0, 0], [w - cast, 0], [0, h - cast], [w - cast, h - cast]].map(([x, y], i) => (
        <Rect key={i} x={x} y={y} width={cast} height={cast} fill="#5F5333" {...NL} />
      ))}
      {/* door end: center seam + hinge ticks on the far short end */}
      {horizontal ? (
        <>
          <Line points={[w - cast, h / 2, w, h / 2]} stroke="#4A3F26" strokeWidth={1.2} {...NL} />
          {doorTicks.map((f) => (
            <Line key={f} points={[w - 2, h * f, w, h * f]} stroke="#4A3F26" strokeWidth={1.6} {...NL} />
          ))}
        </>
      ) : (
        <>
          <Line points={[w / 2, h - cast, w / 2, h]} stroke="#4A3F26" strokeWidth={1.2} {...NL} />
          {doorTicks.map((f) => (
            <Line key={f} points={[w * f, h - 2, w * f, h]} stroke="#4A3F26" strokeWidth={1.6} {...NL} />
          ))}
        </>
      )}
    </>
  );
}

/** Moroccan caidal canvas: ivory ground, black lattice, boteh per cell. */
function diningTentSkin(w: number, h: number) {
  const cell = Math.max(w, h) / 8; // ~5 ft cells on the 40-ft length
  const cells = latticeCells(w, h, cell);
  return (
    <>
      <Rect width={w} height={h} fill="#EDE6D6" stroke="#2C2416" strokeWidth={1.2} {...NL} />
      {gridLinePositions(w, cell).map((x) => (
        <Line key={`v${x}`} points={[x, 0, x, h]} stroke="#1E1A14" strokeWidth={1.4} opacity={0.85} {...NL} />
      ))}
      {gridLinePositions(h, cell).map((y) => (
        <Line key={`h${y}`} points={[0, y, w, y]} stroke="#1E1A14" strokeWidth={1.4} opacity={0.85} {...NL} />
      ))}
      {cells.map((c, i) => {
        const s = (Math.min(c.w, c.h) * 0.55) / 28; // boteh local box is 20×28
        return (
          <Path
            key={i}
            data={BOTEH_PATH}
            x={c.x + c.w / 2 - 10 * s}
            y={c.y + c.h / 2 - 14 * s}
            scaleX={s}
            scaleY={s}
            fill="#1E1A14"
            opacity={0.9}
            {...NL}
          />
        );
      })}
    </>
  );
}

/** 26-ft box truck from above: cab (windshield arc) at -h end + ribbed box. */
function boxTruckSkin(w: number, h: number) {
  const cabH = h * 0.18;
  const rib = (h - cabH) / 9;
  return (
    <>
      <Rect y={cabH} width={w} height={h - cabH} fill="#E8E4DC" stroke="#8C867A" strokeWidth={1} {...NL} />
      {ribPositions(h - cabH, rib).map((y) => (
        <Line key={y} points={[1, cabH + y, w - 1, cabH + y]} stroke="#BDB7A9" strokeWidth={0.7} {...NL} />
      ))}
      <Rect
        width={w}
        height={cabH}
        cornerRadius={[w * 0.25, w * 0.25, 0, 0]}
        fill="#D9D5CC"
        stroke="#8C867A"
        strokeWidth={1}
        {...NL}
      />
      <Arc
        x={w / 2}
        y={cabH * 0.9}
        innerRadius={w * 0.28}
        outerRadius={w * 0.42}
        angle={180}
        rotation={180}
        fill="#6E7B82"
        opacity={0.8}
        {...NL}
      />
      {/* mirrors */}
      <Line points={[-1.5, cabH * 0.7, 0, cabH * 0.7]} stroke="#4A4A4A" strokeWidth={1.4} {...NL} />
      <Line points={[w, cabH * 0.7, w + 1.5, cabH * 0.7]} stroke="#4A4A4A" strokeWidth={1.4} {...NL} />
    </>
  );
}

/** Mahal tent: ivory trefoil, radial seams, 3 peak dots + king pole. */
function mahalSkin(w: number, h: number) {
  const outline = trefoilPoints(w, h, 60);
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2;
  const peakR = R * 0.44;
  const peaks = [-90, 30, 150].map((deg) => {
    const t = (deg * Math.PI) / 180;
    return [cx + peakR * Math.cos(t), cy + peakR * Math.sin(t)] as const;
  });
  return (
    <>
      <Line points={outline} closed fill="#EDE6D6" stroke="#9C8B6E" strokeWidth={1.4} {...NL} />
      <Line points={insetPolygon(outline, 0.86)} closed stroke="#C9BFA8" strokeWidth={0.8} opacity={0.8} {...NL} />
      {/* radial seams from king pole to the canvas edge, every 30° */}
      {Array.from({ length: 12 }, (_, i) => {
        const t = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const r = R * (0.8 + 0.2 * Math.cos(3 * (t + Math.PI / 2)));
        return (
          <Line
            key={i}
            points={[cx, cy, cx + r * Math.cos(t), cy + r * Math.sin(t)]}
            stroke="#C9BFA8"
            strokeWidth={0.6}
            opacity={0.6}
            {...NL}
          />
        );
      })}
      {peaks.map(([px, py], i) => (
        <Circle key={i} x={px} y={py} radius={R * 0.06} fill="#9C8B6E" {...NL} />
      ))}
      <Circle x={cx} y={cy} radius={R * 0.08} fill="#7A6B4F" stroke="#5C5039" strokeWidth={0.8} {...NL} />
    </>
  );
}

/** ShiftPod: reflective silver hexagonal dome — concentric rings, seams, vent. */
function shiftpodSkin(w: number, h: number) {
  const hex = hexagonPoints(w, h);
  const cx = w / 2;
  const cy = h / 2;
  return (
    <>
      <Line points={hex} closed fill="#C7CCD1" stroke="#8E969E" strokeWidth={1.2} {...NL} />
      <Line points={insetPolygon(hex, 0.72)} closed stroke="#A7AEB5" strokeWidth={0.8} opacity={0.9} {...NL} />
      <Line points={insetPolygon(hex, 0.45)} closed fill="#DDE1E5" stroke="#A7AEB5" strokeWidth={0.8} opacity={0.9} {...NL} />
      {Array.from({ length: 6 }, (_, i) => (
        <Line
          key={i}
          points={[hex[i * 2], hex[i * 2 + 1], cx, cy]}
          stroke="#9AA1A8"
          strokeWidth={0.7}
          opacity={0.55}
          {...NL}
        />
      ))}
      <Circle x={cx} y={cy} radius={Math.min(w, h) * 0.07} fill="#8E969E" {...NL} />
    </>
  );
}

/** Kodiak canvas tent: ridge, sloped panels, door tick at +h end. */
function kodiakSkin(w: number, h: number) {
  return (
    <>
      <Rect width={w} height={h} cornerRadius={2} fill="#D4C4A8" stroke="#A8927B" strokeWidth={1} {...NL} />
      <Rect width={w / 2} height={h} cornerRadius={[2, 0, 0, 2]} fill="#C6B392" opacity={0.6} {...NL} />
      <Line points={[w / 2, 2, w / 2, h - 2]} stroke="#8A7658" strokeWidth={1.4} {...NL} />
      {[0.22, 0.5, 0.78].map((f) => (
        <Line key={f} points={[2, h * f, w - 2, h * f]} stroke="#A8927B" strokeWidth={0.6} opacity={0.5} {...NL} />
      ))}
      <Line points={[w * 0.35, h - 1.5, w * 0.65, h - 1.5]} stroke="#6B5B40" strokeWidth={2} {...NL} />
    </>
  );
}

/** RV roof: white body, rounded ends, AC unit, windshield arc at -h end. */
function rvRoofSkin(w: number, h: number) {
  return (
    <>
      <Rect
        width={w}
        height={h}
        cornerRadius={Math.min(w, h) * 0.22}
        fill="#F2F0EA"
        stroke="#9A958A"
        strokeWidth={1}
        {...NL}
      />
      <Line points={[w * 0.12, h * 0.12, w * 0.88, h * 0.12]} stroke="#6E7B82" strokeWidth={1.6} opacity={0.75} {...NL} />
      <Rect
        x={w * 0.2}
        y={h * 0.32}
        width={w * 0.6}
        height={h * 0.16}
        cornerRadius={1.5}
        fill="#D9D5CC"
        stroke="#9A958A"
        strokeWidth={0.8}
        {...NL}
      />
      <Line points={[w * 0.5, h * 0.55, w * 0.5, h * 0.92]} stroke="#C4BFB2" strokeWidth={0.8} opacity={0.8} {...NL} />
    </>
  );
}

/**
 * Aluminet v2: knitted silver shade mesh. Dense two-direction weave with
 * brighter shimmer strands every few lines, over a barely-there fill so
 * whatever sits beneath stays visible. Shared by SHADE_SAIL and SHADE_CLOTH.
 */
function aluminetSkin(w: number, h: number) {
  // Cap the pitch so a big shade panel still reads as woven mesh rather than
  // a flat tint (a 100 ft panel would otherwise get ~7 ft weave spacing).
  const pitch = Math.min(24, Math.max(2, Math.min(w, h) / 14));
  const lines: React.ReactNode[] = [];
  let i = 0;
  // Clipped to the panel: unclipped diagonals overhang by h on each side and
  // Konva measures those endpoints, which throws the selection handles out.
  for (let d = -h; d < w; d += pitch, i++) {
    const shimmer = i % 3 === 0;
    const stroke = shimmer ? '#E8ECEF' : '#AEB6BD';
    const width = shimmer ? 0.9 : 0.45;
    const op = shimmer ? 0.75 : 0.45;
    const a = hatchSegment(d, w, h, 1);
    const b = hatchSegment(d, w, h, -1);
    if (a) lines.push(
      <Line key={`a${d}`} points={a} stroke={stroke} strokeWidth={width} opacity={op} {...NL} />,
    );
    if (b) lines.push(
      <Line key={`b${d}`} points={b} stroke={stroke} strokeWidth={width} opacity={op} {...NL} />,
    );
  }
  return (
    <>
      <Rect width={w} height={h} fill="#C7CCD1" opacity={0.22} {...NL} />
      {lines}
      <Rect width={w} height={h} stroke="#9AA3AB" strokeWidth={0.8} opacity={0.7} {...NL} />
    </>
  );
}

/**
 * Steel-frame fabric canopy (CoverPro carport / Costco 10×20): pale fabric
 * roof, bowed transverse frame tubes showing through, center ridge along the
 * long axis, leg marks at corners and mid-span.
 */
function canopySkin(w: number, h: number, color?: string) {
  const horizontal = w >= h;
  const along = horizontal ? w : h;
  const tubes = ribPositions(along, along / 5);
  const legR = Math.min(w, h) * 0.06;
  // Legs sit a full radius in from the edge, not a flat 2px: a circle centred
  // 2px in overhangs the panel by legR-2, and Konva measures that overhang when
  // sizing the selection handles.
  const legIn = Math.max(2, legR);
  // Fabric colour is per-unit: the Costco canopy is charcoal, the CoverPro
  // carport is pale. Frame/ridge shades derive from whatever fabric is set.
  const fabric = color ?? '#E9E7E0';
  const edge = shadeHex(fabric, -0.42);
  const tube = shadeHex(fabric, -0.2);
  const leg = shadeHex(fabric, -0.58);
  const legs = horizontal
    ? [[legIn, legIn], [w / 2, legIn], [w - legIn, legIn],
       [legIn, h - legIn], [w / 2, h - legIn], [w - legIn, h - legIn]]
    : [[legIn, legIn], [legIn, h / 2], [legIn, h - legIn],
       [w - legIn, legIn], [w - legIn, h / 2], [w - legIn, h - legIn]];
  return (
    <>
      <Rect width={w} height={h} cornerRadius={3} fill={fabric} stroke={edge} strokeWidth={1} {...NL} />
      {tubes.map((p) => (
        <Line
          key={p}
          points={horizontal ? [p, 1.5, p, h - 1.5] : [1.5, p, w - 1.5, p]}
          stroke={tube}
          strokeWidth={0.8}
          opacity={0.8}
          {...NL}
        />
      ))}
      {/* center ridge along the long axis */}
      <Line
        points={horizontal ? [2, h / 2, w - 2, h / 2] : [w / 2, 2, w / 2, h - 2]}
        stroke={edge}
        strokeWidth={1.2}
        opacity={0.7}
        {...NL}
      />
      {legs.map(([x, y], i) => (
        <Circle key={i} x={x} y={y} radius={legR} fill={leg} {...NL} />
      ))}
    </>
  );
}

/**
 * A power plug: a small rating box drawn the way the camp's own power maps draw
 * them — a filled square with a dark border and the amp rating in the middle.
 * The colour comes from the catalog so 15/30/50/L21 stay visually distinct.
 */
function plugSkin(w: number, h: number, color?: string, text?: string) {
  const fill = color ?? '#ED7D31';
  const border = shadeHex(fill, -0.45);
  const fontSize = Math.min(h * 0.62, w * 0.52);
  return (
    <>
      <Rect width={w} height={h} cornerRadius={1} fill={fill} stroke={border} strokeWidth={1.4} {...NL} />
      {text && (
        <Text
          width={w}
          height={h}
          text={text}
          fontSize={fontSize}
          fontStyle="bold"
          fontFamily="Inter, sans-serif"
          fill="#1E1A14"
          align="center"
          verticalAlign="middle"
          {...NL}
        />
      )}
    </>
  );
}


/**
 * Bike parking: a hatched hi-vis zone with a bicycle glyph. Drawn as an area
 * rather than an object, so the glyph is centred and scaled to the smaller
 * dimension and the hatching carries the rest — a long thin strip along a
 * fence still reads correctly.
 */
function bikeParkingSkin(w: number, h: number, color?: string) {
  const fill = color ?? '#E8C33A';
  const edge = shadeHex(fill, -0.45);
  const hatch = shadeHex(fill, -0.25);
  // 45-degree hatching across the zone.
  const step = Math.max(10, Math.min(w, h) / 4);
  const lines: number[][] = [];
  for (let d = -h; d < w; d += step) {
    const seg = hatchSegment(d, w, h, 1);
    if (seg) lines.push(seg);
  }

  // Bicycle glyph, sized off the smaller side and capped so a big zone does
  // not get a comically large bike.
  const g = Math.min(Math.min(w, h) * 0.55, 34);
  const cx = w / 2;
  const cy = h / 2;
  const wheelR = g * 0.28;
  const dx = g * 0.34;
  const ink = shadeHex(fill, -0.72);

  return (
    <>
      <Rect width={w} height={h} cornerRadius={2} fill={fill} stroke={edge} strokeWidth={1.2} {...NL} />
      {lines.map((p, i) => (
        <Line key={i} points={p} stroke={hatch} strokeWidth={1} opacity={0.55} {...NL} />
      ))}
      {g > 12 && (
        <Group x={cx} y={cy} {...NL}>
          <Circle x={-dx} y={0} radius={wheelR} stroke={ink} strokeWidth={g * 0.06} {...NL} />
          <Circle x={dx} y={0} radius={wheelR} stroke={ink} strokeWidth={g * 0.06} {...NL} />
          {/* frame */}
          <Line
            points={[-dx, 0, -g * 0.05, -g * 0.2, dx, 0, -dx, 0, g * 0.1, 0, -g * 0.05, -g * 0.2]}
            stroke={ink}
            strokeWidth={g * 0.055}
            lineJoin="round"
            {...NL}
          />
          {/* handlebar + seat */}
          <Line points={[g * 0.1, 0, g * 0.16, -g * 0.24]} stroke={ink} strokeWidth={g * 0.055} {...NL} />
          <Line points={[g * 0.08, -g * 0.26, g * 0.24, -g * 0.22]} stroke={ink} strokeWidth={g * 0.05} {...NL} />
          <Line points={[-g * 0.14, -g * 0.22, g * 0.04, -g * 0.22]} stroke={ink} strokeWidth={g * 0.05} {...NL} />
        </Group>
      )}
    </>
  );
}

export function renderSkin(
  skinId: SkinId,
  wPx: number,
  hPx: number,
  color?: string,
  text?: string,
): React.ReactNode {
  switch (skinId) {
    case 'container':
      return containerSkin(wPx, hPx);
    case 'diningTent':
      return diningTentSkin(wPx, hPx);
    case 'boxTruck':
      return boxTruckSkin(wPx, hPx);
    case 'mahal':
      return mahalSkin(wPx, hPx);
    case 'shiftpod':
      return shiftpodSkin(wPx, hPx);
    case 'kodiak':
      return kodiakSkin(wPx, hPx);
    case 'rvRoof':
      return rvRoofSkin(wPx, hPx);
    case 'aluminet':
      return aluminetSkin(wPx, hPx);
    case 'canopy':
      return canopySkin(wPx, hPx, color);
    case 'bikeParking':
      return bikeParkingSkin(wPx, hPx, color);
    case 'plug':
      return plugSkin(wPx, hPx, color, text);
  }
}
