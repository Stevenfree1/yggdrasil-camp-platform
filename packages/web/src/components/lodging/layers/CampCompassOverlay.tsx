'use client';

import { M, DISPLAY_FONT, UI_FONT, polar, azToMap, starPoints } from './medallion';
import { MapMedallion } from './MapMedallion';
import { getCampConfig } from '@/lib/config';

/**
 * The camp compass — BRC schematic + wind + sun in ONE medallion, drawn in
 * MAP SPACE: everything points the way it points on the main map beside it
 * (map-top is man-facing, so the Man sits straight up from the camp).
 *
 * The plate's ornamental band is clipped away (MapMedallion scales the
 * raster so only its parchment field shows), which hands the whole disc to
 * the city. Zoomed to Esplanade→G with the Man at center, the camp placed at
 * its BRC address (config/camp.config.ts → brcPlacement), the Temple on
 * the Esplanade edge at 12:00, the gate road at 6:00. The sun's day arc runs
 * sunrise-yellow (ENE) to sunset-red (WNW) with rayed suns at both ends, and
 * the prevailing wind rides in on streamlines that strike the camp dot —
 * sunset and wind share a sector, which is why hardening one edge of camp
 * solves both.
 */

/** "7:30" → 7.5 */
function parseClock(clock: string): number {
  const [h, m = '0'] = clock.split(':');
  return Number(h) + Number(m) / 60;
}

/** "7.5" → "7:30" */
function formatClock(hours: number): string {
  const h = Math.floor(hours);
  return `${h}:${String(Math.round((hours - h) * 60)).padStart(2, '0')}`;
}

const AXIS_BEARING = 45; // BRC's 12:00 direction, degrees true

/** Ring radii, Esplanade then A–G, spread across the full disc (r ≤ 92). */
const RINGS = [
  { name: 'ESP', r: 28 },
  { name: 'A', r: 34.3 },
  { name: 'B', r: 40.6 },
  { name: 'C', r: 46.9 },
  { name: 'D', r: 53.2 },
  { name: 'E', r: 59.5 },
  { name: 'F', r: 65.8 },
  { name: 'G', r: 72.1 },
];
const RING_STEP = 6.3;
const G_R = 72.1;
const CLOCK_R = 77.5; // numerals
const SUN_R = 83; // day arc

const AZ = { wind: 235, sunrise: 79, sunset: 281 } as const;

/** True bearing of a BRC clock position. */
const clockBearing = (hours: number) => (AXIS_BEARING + hours * 30) % 360;

interface Props {
  /** True bearing (deg) that map-top faces; null = not configured. */
  bearing: number | null;
  label?: string;
}

export function CampCompassOverlay({ bearing, label = getCampConfig().name }: Props) {
  // The camp's address: its clock position, between `street` and the next ring out.
  const placement = getCampConfig().brcPlacement ?? { clock: '7:30', street: 'D' };
  const campClock = parseClock(placement.clock);
  const ringIdx = Math.max(0, RINGS.findIndex((r) => r.name === placement.street.toUpperCase()));
  const innerRing = RINGS[ringIdx];
  const outerRing = RINGS[ringIdx + 1] ?? { name: '', r: innerRing.r + RING_STEP };
  const CAMP_R = (innerRing.r + outerRing.r) / 2;
  // The half-hour radial street at or just before the camp, drawn as its radial edge.
  const radialClock = Math.floor(campClock * 2) / 2;

  if (bearing == null) {
    return (
      <div
        className="!absolute top-3 right-3 !z-10 rounded border px-3 py-2 text-xs shadow"
        style={{ background: M.parchment, borderColor: M.tan, color: M.ink, fontFamily: UI_FONT }}
      >
        Compass needs a <span className="font-medium">frontage bearing</span> in map config.
      </div>
    );
  }

  /** True azimuth → map-space angle. */
  const m = (az: number) => azToMap(az, bearing);

  /** Street arc, 2:00 round to 10:00 (the inhabited arc), in map space. */
  const arc = (r: number): string => {
    const [x1, y1] = polar(m(clockBearing(2)), r);
    const [x2, y2] = polar(m(clockBearing(10)), r);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 1 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };

  const campAngle = m(clockBearing(campClock));
  const radialAngle = m(clockBearing(radialClock));
  const [cx, cy] = polar(campAngle, CAMP_R);

  // Wind striking the camp dot from map-right (WSW) — matches the main map.
  const windAngle = m(AZ.wind);
  const wa = (windAngle * Math.PI) / 180;
  const [wpx, wpy] = [Math.cos(wa), Math.sin(wa)]; // unit perpendicular
  // Dusty lake blue: reads as "air", not "hazard", next to the sunset reds.
  const WIND_BLUE = '#3E6F94';

  // Sun day arc endpoints.
  const riseA = m(AZ.sunrise);
  const setA = m(AZ.sunset);
  const [rx, ry] = polar(riseA, SUN_R);
  const [sx, sy] = polar(setA, SUN_R);

  // Gate road at 6:00; Temple on the Esplanade edge at 12:00, opposite it.
  const gateAngle = m(clockBearing(6));
  const [gx1, gy1] = polar(gateAngle, G_R);
  const [gx2, gy2] = polar(gateAngle, 79.5);
  const templeAngle = m(clockBearing(12));
  const [tx, ty] = polar(templeAngle, RINGS[0].r - 1);

  const northAngle = m(0);
  const [nx, ny] = polar(northAngle, 81);
  const [ntx, nty] = polar(northAngle, 90);

  /** Rayed sun disc with a soft glow halo. */
  const sun = (x: number, y: number, r: number, fill: string, stroke: string) => (
    <g>
      <circle cx={x} cy={y} r={r * 2.4} fill={fill} opacity={0.18} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const a = ((deg + 20) * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={x + Math.sin(a) * (r + 1.2)}
            y1={y - Math.cos(a) * (r + 1.2)}
            x2={x + Math.sin(a) * (r + 4.4)}
            y2={y - Math.cos(a) * (r + 4.4)}
            stroke={stroke}
            strokeWidth={1.3}
            strokeLinecap="round"
            opacity={0.9}
          />
        );
      })}
      <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1} />
    </g>
  );

  return (
    <MapMedallion
      corner="top-right"
      caption={label}
      subCaption="Wind SW–W PM · Sunset WNW"
      plateSrc="/images/compass-plate.webp"
      ariaLabel={`Camp compass: Black Rock City schematic aligned with the map — camp at ${placement.clock} & ${innerRing.name}, the Man at center, Temple at twelve, prevailing wind streamlines, and a sunrise-to-sunset arc`}
    >
      <defs>
        {/* Day gradient across the disc: sunrise yellow → noon amber → sunset red. */}
        <linearGradient id="cc-day" gradientUnits="userSpaceOnUse" x1={rx} y1={ry} x2={sx} y2={sy}>
          <stop offset="0%" stopColor="#E9C24A" />
          <stop offset="50%" stopColor="#DE9A34" />
          <stop offset="100%" stopColor="#BE4F28" />
        </linearGradient>
      </defs>

      {/* hour spokes */}
      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => {
        const [x1, y1] = polar(m(clockBearing(h)), RINGS[0].r);
        const [x2, y2] = polar(m(clockBearing(h)), G_R);
        return (
          <line
            key={h}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={M.sage}
            strokeWidth={h % 3 === 0 ? 0.6 : 0.35}
            opacity={h % 3 === 0 ? 0.35 : 0.18}
          />
        );
      })}

      {/* The camp's nearest radial street — treated as a street, not a faint clock tick. */}
      <line
        x1={polar(radialAngle, RINGS[0].r)[0]}
        y1={polar(radialAngle, RINGS[0].r)[1]}
        x2={polar(radialAngle, 79.5)[0]}
        y2={polar(radialAngle, 79.5)[1]}
        stroke={M.sienna}
        strokeWidth={2.8}
        opacity={0.9}
      />
      <text
        x={polar(radialAngle - 3, 82)[0]}
        y={polar(radialAngle - 3, 82)[1] + 2}
        textAnchor="middle"
        style={{ fontFamily: UI_FONT }}
        fontSize={6.5}
        fontWeight={700}
        fill={M.sienna}
      >
        {formatClock(radialClock)}
      </text>

      {/* street rings: Esplanade clear, the camp's two rings emphasised, G present */}
      {RINGS.map(({ name, r }) => {
        const emphasised = name === innerRing.name || name === outerRing.name;
        return (
          <path
            key={name}
            d={arc(r)}
            fill="none"
            stroke={emphasised ? M.sienna : M.sage}
            strokeWidth={emphasised ? 3.2 : name === 'ESP' ? 1 : 0.55}
            opacity={emphasised ? 0.9 : name === 'ESP' ? 0.55 : name === 'G' ? 0.5 : 0.26}
          />
        );
      })}

      {/* ring letters, cascading clear of each other */}
      {[innerRing, outerRing, RINGS[RINGS.length - 1]]
        .filter((ring, i, all) => ring.name && all.findIndex((o) => o.name === ring.name) === i)
        .map((ring, i) => ({ t: ring.name, r: ring.r, a: campAngle - 30 - i * 9 }))
        .map(({ t, r, a }) => {
        const [x, y] = polar(a, r);
        const emphasised = t === innerRing.name || t === outerRing.name;
        return (
          <text
            key={t}
            x={x}
            y={y + 2.2}
            textAnchor="middle"
            style={{ fontFamily: UI_FONT }}
            fontSize={emphasised ? 8 : 6.5}
            fontWeight={emphasised ? 800 : 600}
            fill={emphasised ? M.sienna : M.ink}
            opacity={emphasised ? 1 : 0.55}
          >
            {t}
          </text>
        );
      })}

      {/* clock numerals ("6" belongs to the gate road) */}
      {[
        { h: 3, t: '3' },
        { h: 9, t: '9' },
        { h: 12, t: '12' },
      ].map(({ h, t }) => {
        const [x, y] = polar(m(clockBearing(h)), CLOCK_R);
        return (
          <text
            key={t}
            x={x}
            y={y + 3}
            textAnchor="middle"
            style={{ fontFamily: UI_FONT }}
            fontSize={8.5}
            fontWeight={600}
            fill={M.ink}
            opacity={0.5}
          >
            {t}
          </text>
        );
      })}

      {/* gate road */}
      <line x1={gx1} y1={gy1} x2={gx2} y2={gy2} stroke={M.sage} strokeWidth={1.6} opacity={0.7} />
      <text
        x={polar(gateAngle + 9, 76.5)[0]}
        y={polar(gateAngle + 9, 76.5)[1] + 2}
        textAnchor="middle"
        style={{ fontFamily: UI_FONT }}
        fontSize={6}
        letterSpacing={0.4}
        fill={M.sage}
        opacity={0.85}
      >
        GATE
      </text>

      {/* the Temple, on the Esplanade edge at 12:00 */}
      <rect
        x={tx - 2.5}
        y={ty - 2.5}
        width={5}
        height={5}
        transform={`rotate(45 ${tx} ${ty})`}
        fill={M.cream}
        stroke={M.ink}
        strokeWidth={0.8}
        opacity={0.85}
      />
      <text
        x={polar(templeAngle, RINGS[1].r + 4)[0]}
        y={polar(templeAngle, RINGS[1].r + 4)[1] + 2}
        textAnchor="middle"
        style={{ fontFamily: UI_FONT }}
        fontSize={5}
        letterSpacing={0.4}
        fill={M.sage}
        opacity={0.85}
      >
        TEMPLE
      </text>

      {/* the Man */}
      <polygon points={starPoints(7, 2.8)} fill={M.gold} stroke={M.ink} strokeWidth={0.6} />
      <text
        x={0}
        y={15}
        textAnchor="middle"
        style={{ fontFamily: UI_FONT }}
        fontSize={6}
        letterSpacing={0.5}
        fill={M.ink}
        opacity={0.55}
      >
        MAN
      </text>

      {/* sun day arc: yellow dawn → red dusk, rayed suns at both ends */}
      <path
        d={`M ${rx.toFixed(1)} ${ry.toFixed(1)} A ${SUN_R} ${SUN_R} 0 1 1 ${sx.toFixed(1)} ${sy.toFixed(1)}`}
        fill="none"
        stroke="url(#cc-day)"
        strokeWidth={2.4}
        opacity={0.9}
      />
      {sun(rx, ry, 4.2, '#F0D06A', '#D9A62E')}
      {sun(sx, sy, 4.6, '#D96B2F', '#A93E20')}
      <text
        x={polar(riseA, 72)[0]}
        y={polar(riseA, 72)[1] + 2}
        textAnchor="middle"
        style={{ fontFamily: UI_FONT }}
        fontSize={6}
        letterSpacing={0.4}
        fill="#B58A20"
      >
        RISE
      </text>
      <text
        x={polar(setA - 7, 71)[0]}
        y={polar(setA - 7, 71)[1] + 2}
        textAnchor="middle"
        style={{ fontFamily: UI_FONT }}
        fontSize={6}
        letterSpacing={0.4}
        fill="#A94A24"
      >
        SET
      </text>

      {/* prevailing wind: streamlines riding in from map-right, striking the camp */}
      <g transform={`translate(${cx} ${cy})`}>
        {[-7, 7].map((off) => {
          const [ox1, oy1] = polar(windAngle, 36);
          const [ox2, oy2] = polar(windAngle, 19);
          return (
            <line
              key={off}
              x1={ox1 + wpx * off}
              y1={oy1 + wpy * off}
              x2={ox2 + wpx * off}
              y2={oy2 + wpy * off}
              stroke={WIND_BLUE}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeDasharray="4 3"
              opacity={0.55}
            />
          );
        })}
        <line
          x1={polar(windAngle, 38)[0]}
          y1={polar(windAngle, 38)[1]}
          x2={polar(windAngle, 14)[0]}
          y2={polar(windAngle, 14)[1]}
          stroke={WIND_BLUE}
          strokeWidth={4.4}
          strokeLinecap="round"
        />
        <polygon
          points={`${polar(windAngle, 6.5)[0]},${polar(windAngle, 6.5)[1]} ${polar(windAngle, 14)[0] + wpx * 6},${polar(windAngle, 14)[1] + wpy * 6} ${polar(windAngle, 14)[0] - wpx * 6},${polar(windAngle, 14)[1] - wpy * 6}`}
          fill={WIND_BLUE}
        />
      </g>

      {/* camp — the point of the whole instrument */}
      <circle cx={cx} cy={cy} r={10} fill={M.gold} opacity={0.2} />
      <circle cx={cx} cy={cy} r={5} fill={M.gold} stroke={M.ink} strokeWidth={1.2} />
      <circle cx={cx} cy={cy} r={1.8} fill={M.ink} opacity={0.7} />

      {/* north, wherever it falls */}
      <polygon
        points={`${ntx},${nty} ${polar(northAngle + 3.5, 86)[0]},${polar(northAngle + 3.5, 86)[1]} ${polar(northAngle - 3.5, 86)[0]},${polar(northAngle - 3.5, 86)[1]}`}
        fill={M.ink}
        opacity={0.65}
      />
      <text
        x={nx}
        y={ny + 3.5}
        textAnchor="middle"
        style={{ fontFamily: DISPLAY_FONT }}
        fontSize={11}
        fill={M.ink}
        opacity={0.8}
      >
        N
      </text>
    </MapMedallion>
  );
}
