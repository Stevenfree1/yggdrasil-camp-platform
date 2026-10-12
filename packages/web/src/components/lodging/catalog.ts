import type { LodgingUnitKind } from '@prisma/client';
import { hexagonPoints, trefoilPoints } from './skin-geometry';

/**
 * How a unit's body (footprint) is drawn on the canvas. The footprint is the
 * filled, hit-testable shape; kind-specific decoration (wheels, A-frame, hatch)
 * is layered on top by LodgingUnitShape.
 *
 *  - rect    : axis-aligned rectangle (optionally rounded)
 *  - polygon : an arbitrary closed polygon, points derived from w/h (octagon, triangle)
 *  - line    : a dashed perimeter line with a transparent interior (BOUNDARY)
 *  - none    : no body — label-only entities (STREET_LABEL, TEXT_LABEL)
 */
export type Footprint =
  | { type: 'rect'; cornerRadius?: number }
  | { type: 'polygon' }
  | { type: 'line'; dashed?: boolean }
  | { type: 'none' };

export type ItemCategory = 'sleeping' | 'structure' | 'annotation' | 'infrastructure';
export type Decoration = 'rv' | 'tent' | 'dorm' | 'hatch' | 'power' | null;

/**
 * Realistic top-down renderers implemented in skins.tsx. A kind with a skin
 * draws that instead of its legacy `decoration`.
 */
export type SkinId =
  | 'container' | 'diningTent' | 'boxTruck' | 'mahal'
  | 'shiftpod' | 'kodiak' | 'rvRoof' | 'aluminet' | 'canopy' | 'plug'
  | 'bikeParking';

export interface ItemDef {
  kind: LodgingUnitKind;
  /** Human label shown in the toolbar / palette. */
  label: string;
  category: ItemCategory;
  /** Default footprint in feet when a new unit of this kind is created. */
  defaultSize: { w: number; h: number };
  /** Default fill colour (hex) before any per-unit or color-mode override. */
  color: string;
  /** Whether this kind can hold member occupants (drives assignment UI). */
  assignable: boolean;
  footprint: Footprint;
  /** Extra glyph drawn over the body, rendered by LodgingUnitShape. */
  decoration: Decoration;
  /** Realistic top-down skin; supersedes `decoration` when present. */
  skin?: SkinId;
  /**
   * Amp rating stamped on a power plug ('15', '30', '50', 'L21'). Present only
   * on plug kinds; also what the Power layer tallies into the CES order.
   */
  plugRating?: string;
  /**
   * Plugs exist for the power company, not for the camp layout — they render
   * only while the map's Power layer is switched on.
   */
  powerLayerOnly?: boolean;
}

/**
 * The single source of truth for every placeable item. The editor, renderer,
 * importer and the back-compat maps in types.ts all read from here, so adding
 * or re-modelling an item is a one-entry change.
 */
export const ITEM_CATALOG: Record<LodgingUnitKind, ItemDef> = {
  TENT: {
    kind: 'TENT', label: 'Tent', category: 'sleeping',
    // Standard tent footprint is 10×14 (typical cabin-style tent footprint).
    defaultSize: { w: 10, h: 14 }, color: '#D4C4A8', assignable: true,
    footprint: { type: 'rect', cornerRadius: 3 }, decoration: 'tent', skin: 'kodiak',
  },
  RV: {
    kind: 'RV', label: 'RV', category: 'sleeping',
    defaultSize: { w: 8, h: 25 }, color: '#4A5D5A', assignable: true,
    footprint: { type: 'rect' }, decoration: 'rv', skin: 'rvRoof',
  },
  SHIFTPOD: {
    kind: 'SHIFTPOD', label: 'ShiftPod', category: 'sleeping',
    // Real ShiftPod (SP2/SPX): 12 ft point-to-point hexagonal footprint.
    defaultSize: { w: 12, h: 12 }, color: '#C7CCD1', assignable: true,
    footprint: { type: 'polygon' }, decoration: null, skin: 'shiftpod',
  },
  TRAILER: {
    kind: 'TRAILER', label: 'Trailer', category: 'sleeping',
    defaultSize: { w: 8, h: 16 }, color: '#6B7F7C', assignable: true,
    footprint: { type: 'rect' }, decoration: 'rv',
  },
  DORM: {
    kind: 'DORM', label: 'Dorm', category: 'sleeping',
    defaultSize: { w: 14, h: 20 }, color: '#8A9B97', assignable: true,
    footprint: { type: 'rect', cornerRadius: 3 }, decoration: 'dorm',
  },
  STRUCTURE: {
    kind: 'STRUCTURE', label: 'Structure', category: 'structure',
    defaultSize: { w: 20, h: 20 }, color: '#A8927B', assignable: false,
    footprint: { type: 'rect', cornerRadius: 3 }, decoration: 'hatch',
  },
  SHADE_SAIL: {
    kind: 'SHADE_SAIL', label: 'Shade Sail', category: 'structure',
    defaultSize: { w: 18, h: 16 }, color: '#C7CCD1', assignable: false,
    footprint: { type: 'polygon' }, decoration: null, skin: 'aluminet',
  },
  CONTAINER: {
    kind: 'CONTAINER', label: 'Container', category: 'structure',
    // Standard 20-ft ISO box. Rotation encodes door orientation (doors at +h end).
    defaultSize: { w: 20, h: 8 }, color: '#B7A268', assignable: false,
    footprint: { type: 'rect' }, decoration: null, skin: 'container',
  },
  DINING_TENT: {
    kind: 'DINING_TENT', label: 'Dining Tent', category: 'structure',
    // Moroccan caidal tent, 6 × 12 m ⇒ 20 × 40 ft (seats ~50).
    defaultSize: { w: 20, h: 40 }, color: '#EDE6D6', assignable: false,
    footprint: { type: 'rect' }, decoration: null, skin: 'diningTent',
  },
  BOX_TRUCK: {
    kind: 'BOX_TRUCK', label: 'Box Truck', category: 'structure',
    // 26-ft box truck: ~33 ft overall × 8.5 ft wide. Cab at -h end.
    defaultSize: { w: 8.5, h: 33 }, color: '#E8E4DC', assignable: false,
    footprint: { type: 'rect' }, decoration: null, skin: 'boxTruck',
  },
  MAHAL_TENT: {
    kind: 'MAHAL_TENT', label: 'Mahal Tent', category: 'structure',
    // Large mahal-style tent: ≈30 ft across, trefoil plan, 3 peaks + king pole.
    defaultSize: { w: 30, h: 30 }, color: '#EDE6D6', assignable: false,
    footprint: { type: 'polygon' }, decoration: null, skin: 'mahal',
  },
  CANOPY: {
    kind: 'CANOPY', label: 'Canopy', category: 'structure',
    // Steel-frame fabric canopy: Costco 10×20 default; CoverPro carport is 10×17.
    defaultSize: { w: 10, h: 20 }, color: '#E9E7E0', assignable: false,
    footprint: { type: 'rect', cornerRadius: 2 }, decoration: null, skin: 'canopy',
  },
  SHADE_CLOTH: {
    kind: 'SHADE_CLOTH', label: 'Shade Cloth', category: 'structure',
    // Aluminet panel laid over an area; use per-unit opacity (~0.35) so what's
    // beneath stays visible.
    defaultSize: { w: 20, h: 20 }, color: '#C7CCD1', assignable: false,
    footprint: { type: 'rect' }, decoration: null, skin: 'aluminet',
  },
  BIKE_PARKING: {
    kind: 'BIKE_PARKING', label: 'Bike Parking', category: 'infrastructure',
    // A marked area rather than an object: stretch it to fit whatever corner
    // the racks end up in. Drop per-unit opacity if it should sit under other
    // layers. Hi-vis yellow so it reads as a zone, not a structure.
    defaultSize: { w: 30, h: 15 }, color: '#E8C33A', assignable: false,
    footprint: { type: 'rect', cornerRadius: 2 }, decoration: null, skin: 'bikeParking',
  },
  WATER_TANK: {
    kind: 'WATER_TANK', label: 'Water Tank', category: 'infrastructure',
    // Round poly tank. A 1100 gal vertical tank is ~6.5 ft across; the huge
    // cornerRadius is what makes it a circle — Konva clamps it to half the
    // shorter side, so any square WATER_TANK draws round without needing a
    // separate footprint type.
    defaultSize: { w: 7, h: 7 }, color: '#14532D', assignable: false,
    footprint: { type: 'rect', cornerRadius: 999 }, decoration: null,
  },
  POD: {
    kind: 'POD', label: 'Pod', category: 'sleeping',
    // One sleeping compartment inside a trailer. A 53 ft trailer splits into
    // five, so ~10.6 ft each; assignable because people are billeted per pod,
    // not per trailer.
    defaultSize: { w: 10.6, h: 8 }, color: '#8A9B97', assignable: true,
    footprint: { type: 'rect', cornerRadius: 2 }, decoration: null,
  },
  HITCH: {
    kind: 'HITCH', label: 'Hitch', category: 'structure',
    // A trailer drawn as a plain rectangle gives no clue which end is the nose,
    // which matters because the pods are numbered rear-to-front. This is the
    // tongue: a short dark bar sticking out of the front end.
    defaultSize: { w: 2, h: 2 }, color: '#3F3F46', assignable: false,
    footprint: { type: 'rect', cornerRadius: 1 }, decoration: null,
  },
  BOUNDARY: {
    kind: 'BOUNDARY', label: 'Boundary', category: 'annotation',
    defaultSize: { w: 80, h: 4 }, color: '#2C2416', assignable: false,
    footprint: { type: 'line', dashed: true }, decoration: null,
  },
  STREET_LABEL: {
    kind: 'STREET_LABEL', label: 'Street Label', category: 'annotation',
    defaultSize: { w: 12, h: 4 }, color: '#9C8B6E', assignable: false,
    footprint: { type: 'none' }, decoration: null,
  },
  TEXT_LABEL: {
    kind: 'TEXT_LABEL', label: 'Text', category: 'annotation',
    defaultSize: { w: 12, h: 4 }, color: '#2C2416', assignable: false,
    footprint: { type: 'none' }, decoration: null,
  },
  // ── Power plugs ──────────────────────────────────────────────────────────
  // Connection points for the CES order, drawn like the rating boxes on the
  // camp's own power maps. Hidden unless the Power layer is on.
  PLUG_15A: {
    kind: 'PLUG_15A', label: '15A Plug', category: 'infrastructure',
    defaultSize: { w: 5, h: 5 }, color: '#ED7D31', assignable: false,
    footprint: { type: 'rect', cornerRadius: 1 }, decoration: null,
    skin: 'plug', plugRating: '15', powerLayerOnly: true,
  },
  PLUG_30A: {
    kind: 'PLUG_30A', label: '30A Plug', category: 'infrastructure',
    defaultSize: { w: 5, h: 5 }, color: '#9DC3E6', assignable: false,
    footprint: { type: 'rect', cornerRadius: 1 }, decoration: null,
    skin: 'plug', plugRating: '30', powerLayerOnly: true,
  },
  PLUG_50A: {
    kind: 'PLUG_50A', label: '50A Plug', category: 'infrastructure',
    defaultSize: { w: 5, h: 5 }, color: '#F4A6A6', assignable: false,
    footprint: { type: 'rect', cornerRadius: 1 }, decoration: null,
    skin: 'plug', plugRating: '50', powerLayerOnly: true,
  },
  PLUG_L21_30: {
    kind: 'PLUG_L21_30', label: 'L21-30 (stage)', category: 'infrastructure',
    defaultSize: { w: 8, h: 5 }, color: '#FAF7F2', assignable: false,
    footprint: { type: 'rect', cornerRadius: 1 }, decoration: null,
    skin: 'plug', plugRating: 'L21', powerLayerOnly: true,
  },
  POWER_BOX: {
    kind: 'POWER_BOX', label: 'Power Box', category: 'infrastructure',
    defaultSize: { w: 4, h: 4 }, color: '#D4AF37', assignable: false,
    footprint: { type: 'rect', cornerRadius: 1 }, decoration: 'power',
  },
};

export const ITEM_DEFS: ItemDef[] = Object.values(ITEM_CATALOG);

/** Kinds that only render while the Power layer is on. */
export const POWER_LAYER_KINDS: LodgingUnitKind[] = ITEM_DEFS
  .filter((d) => d.powerLayerOnly)
  .map((d) => d.kind);

export function isPowerLayerKind(kind: LodgingUnitKind): boolean {
  return ITEM_CATALOG[kind].powerLayerOnly === true;
}

/** An isosceles triangle pointing up — a shade sail. */
function trianglePoints(wPx: number, hPx: number): number[] {
  return [wPx / 2, 0, wPx, hPx, 0, hPx];
}

/**
 * Polygon vertices (flat [x0,y0,x1,y1,...] in local px, origin at the unit's
 * top-left) for kinds whose footprint is a polygon. Returns null for rect,
 * line and bodyless kinds, whose bodies are drawn directly by LodgingUnitShape.
 */
export function footprintPoints(kind: LodgingUnitKind, wPx: number, hPx: number): number[] | null {
  if (ITEM_CATALOG[kind].footprint.type !== 'polygon') return null;
  switch (kind) {
    case 'SHIFTPOD':
      return hexagonPoints(wPx, hPx);
    case 'MAHAL_TENT':
      return trefoilPoints(wPx, hPx);
    case 'SHADE_SAIL':
      return trianglePoints(wPx, hPx);
    default:
      return null;
  }
}
