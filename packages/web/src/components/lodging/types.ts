import type { LodgingUnitKind, MapColorMode } from '@prisma/client';
import { ITEM_DEFS } from './catalog';

export type { LodgingUnitKind, MapColorMode };
export { ITEM_CATALOG, ITEM_DEFS, footprintPoints } from './catalog';
export type { ItemDef, Footprint, ItemCategory, Decoration } from './catalog';

export interface EditorUnit {
  id: string; // real UUID from server, or `tmp-${random}` for unsaved
  kind: LodgingUnitKind;
  label: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string | null;
  partnerCamp: string | null;
  notes: string | null;
  sortOrder: number;
  opacity: number;
  dirty: boolean;
  isNew: boolean;
}

// Back-compat maps, now derived from the single catalog so adding/retuning an
// item is a one-entry change in catalog.ts.
export const KIND_DEFAULTS = Object.fromEntries(
  ITEM_DEFS.map((d) => [d.kind, { w: d.defaultSize.w, h: d.defaultSize.h, label: d.label }]),
) as Record<LodgingUnitKind, { w: number; h: number; label: string }>;

export const KIND_COLORS = Object.fromEntries(
  ITEM_DEFS.map((d) => [d.kind, d.color]),
) as Record<LodgingUnitKind, string>;

export const KIND_LABELS = Object.fromEntries(
  ITEM_DEFS.map((d) => [d.kind, d.label]),
) as Record<LodgingUnitKind, string>;

export const ASSIGNABLE_LODGING_KINDS = new Set<LodgingUnitKind>(
  ITEM_DEFS.filter((d) => d.assignable).map((d) => d.kind),
);

export function isAssignableLodgingKind(kind: LodgingUnitKind): boolean {
  return ASSIGNABLE_LODGING_KINDS.has(kind);
}

export const PX_PER_FT = 6; // base scale: 1 ft = 6 px at zoom 1.0
export const GRID_COLOR = '#4A5D5A26'; // sage at ~15%
export const GRID_MAJOR_COLOR = '#4A5D5A4D'; // sage at ~30%
export const SELECTED_STROKE = '#D4AF37'; // gold

export function snap(value: number, gridSizeFt: number): number {
  if (gridSizeFt <= 0) return value;
  return Math.round(value / gridSizeFt) * gridSizeFt;
}

/**
 * Derive default unit dimensions for a SeasonMember from their housingType
 * and free-text housingSize. Examples of housingSize strings observed in
 * historical data: "10x12", "8x30", "25ft", "20ft RV", "shiftpod 8x8".
 */
export function defaultsForMember(
  housingType: string | null | undefined,
  housingSize: string | null | undefined,
): { kind: LodgingUnitKind; w: number; h: number } {
  const t = (housingType ?? 'TENT').toUpperCase();
  const kind: LodgingUnitKind =
    t === 'RV' ? 'RV' :
    t === 'TRAILER' ? 'TRAILER' :
    t === 'SHIFTPOD' ? 'SHIFTPOD' :
    t === 'DORM' ? 'DORM' :
    'TENT';
  const defaults = KIND_DEFAULTS[kind];

  if (housingSize) {
    // Try "WxH" pattern first
    const m1 = housingSize.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
    if (m1) {
      return { kind, w: Number(m1[1]), h: Number(m1[2]) };
    }
    // Try "Nft" — assume length, keep default width
    const m2 = housingSize.match(/(\d+(?:\.\d+)?)\s*ft/i);
    if (m2) {
      const len = Number(m2[1]);
      // For RV/TRAILER, length is along the long axis (h direction)
      if (kind === 'RV' || kind === 'TRAILER') return { kind, w: defaults.w, h: len };
      return { kind, w: len, h: len };
    }
  }
  return { kind, w: defaults.w, h: defaults.h };
}
