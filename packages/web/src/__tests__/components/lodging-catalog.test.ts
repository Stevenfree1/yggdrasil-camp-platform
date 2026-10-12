import { ITEM_CATALOG, footprintPoints } from '../../components/lodging/catalog';
import type { LodgingUnitKind } from '../../components/lodging/types';

const ALL_KINDS: LodgingUnitKind[] = [
  'TENT', 'RV', 'SHIFTPOD', 'TRAILER', 'DORM', 'STRUCTURE',
  'BOUNDARY', 'STREET_LABEL', 'POWER_BOX', 'SHADE_SAIL', 'TEXT_LABEL',
];

describe('item catalog', () => {
  it('has a self-consistent entry for every kind', () => {
    for (const k of ALL_KINDS) {
      expect(ITEM_CATALOG[k]).toBeDefined();
      expect(ITEM_CATALOG[k].kind).toBe(k);
      expect(ITEM_CATALOG[k].defaultSize.w).toBeGreaterThan(0);
      expect(ITEM_CATALOG[k].defaultSize.h).toBeGreaterThan(0);
      expect(ITEM_CATALOG[k].color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('marks sleeping kinds assignable and annotations/structures not', () => {
    expect(ITEM_CATALOG.TENT.assignable).toBe(true);
    expect(ITEM_CATALOG.RV.assignable).toBe(true);
    expect(ITEM_CATALOG.SHIFTPOD.assignable).toBe(true);
    expect(ITEM_CATALOG.TRAILER.assignable).toBe(true);
    expect(ITEM_CATALOG.DORM.assignable).toBe(true);
    expect(ITEM_CATALOG.STRUCTURE.assignable).toBe(false);
    expect(ITEM_CATALOG.BOUNDARY.assignable).toBe(false);
    expect(ITEM_CATALOG.TEXT_LABEL.assignable).toBe(false);
    expect(ITEM_CATALOG.SHADE_SAIL.assignable).toBe(false);
  });
});

describe('footprintPoints', () => {
  it('returns a hexagon (6 vertices) for a ShiftPod', () => {
    // Real ShiftPod footprint is a 12-ft flat-top hexagon (shiftpod.com).
    const pts = footprintPoints('SHIFTPOD', 48, 48);
    expect(pts).not.toBeNull();
    expect(pts!.length).toBe(12); // 6 (x,y) pairs
    // first vertex sits at (w/4, 0)
    expect(pts![0]).toBeCloseTo(12);
    expect(pts![1]).toBeCloseTo(0);
    // every coordinate stays within the bounding box
    for (let i = 0; i < pts!.length; i += 2) {
      expect(pts![i]).toBeGreaterThanOrEqual(0);
      expect(pts![i]).toBeLessThanOrEqual(48);
      expect(pts![i + 1]).toBeGreaterThanOrEqual(0);
      expect(pts![i + 1]).toBeLessThanOrEqual(48);
    }
  });

  it('returns a triangle (3 vertices) for a shade sail', () => {
    const pts = footprintPoints('SHADE_SAIL', 20, 16);
    expect(pts).not.toBeNull();
    expect(pts!.length).toBe(6); // 3 (x,y) pairs
  });

  it('returns null for rectangular / bodyless kinds', () => {
    expect(footprintPoints('TENT', 10, 10)).toBeNull();
    expect(footprintPoints('STRUCTURE', 10, 10)).toBeNull();
    expect(footprintPoints('TEXT_LABEL', 10, 10)).toBeNull();
    expect(footprintPoints('BOUNDARY', 80, 4)).toBeNull();
  });
});
