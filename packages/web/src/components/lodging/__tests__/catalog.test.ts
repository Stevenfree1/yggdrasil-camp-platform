import { ITEM_CATALOG, ITEM_DEFS, footprintPoints } from '../catalog';

describe('ITEM_CATALOG', () => {
  it('has real-world default sizes for researched kinds', () => {
    expect(ITEM_CATALOG.CONTAINER.defaultSize).toEqual({ w: 20, h: 8 });
    expect(ITEM_CATALOG.DINING_TENT.defaultSize).toEqual({ w: 20, h: 40 });
    expect(ITEM_CATALOG.BOX_TRUCK.defaultSize).toEqual({ w: 8.5, h: 33 });
    expect(ITEM_CATALOG.MAHAL_TENT.defaultSize).toEqual({ w: 30, h: 30 });
    expect(ITEM_CATALOG.SHIFTPOD.defaultSize).toEqual({ w: 12, h: 12 });
    expect(ITEM_CATALOG.CANOPY.defaultSize).toEqual({ w: 10, h: 20 });
    expect(ITEM_CATALOG.SHADE_CLOTH.defaultSize).toEqual({ w: 20, h: 20 });
  });

  it('every entry has label, size, footprint, category', () => {
    for (const def of ITEM_DEFS) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.defaultSize.w).toBeGreaterThan(0);
      expect(def.footprint.type).toBeDefined();
      expect(def.category).toBeDefined();
    }
  });

  it('skinned kinds declare a skin id', () => {
    expect(ITEM_CATALOG.CONTAINER.skin).toBe('container');
    expect(ITEM_CATALOG.DINING_TENT.skin).toBe('diningTent');
    expect(ITEM_CATALOG.BOX_TRUCK.skin).toBe('boxTruck');
    expect(ITEM_CATALOG.MAHAL_TENT.skin).toBe('mahal');
    expect(ITEM_CATALOG.SHIFTPOD.skin).toBe('shiftpod');
    expect(ITEM_CATALOG.TENT.skin).toBe('kodiak');
    expect(ITEM_CATALOG.RV.skin).toBe('rvRoof');
    expect(ITEM_CATALOG.SHADE_SAIL.skin).toBe('aluminet');
    expect(ITEM_CATALOG.SHADE_CLOTH.skin).toBe('aluminet');
    expect(ITEM_CATALOG.CANOPY.skin).toBe('canopy');
  });
});

describe('footprintPoints', () => {
  it('SHIFTPOD is a hexagon (6 vertices)', () => {
    expect(footprintPoints('SHIFTPOD', 72, 72)).toHaveLength(12);
  });

  it('MAHAL_TENT is a trefoil polygon', () => {
    const pts = footprintPoints('MAHAL_TENT', 180, 180);
    expect(pts).not.toBeNull();
    expect(pts!.length).toBeGreaterThanOrEqual(48 * 2);
  });
});

describe('bike parking', () => {
  it('is an area, not an object — wider than tall and non-assignable', () => {
    const def = ITEM_CATALOG.BIKE_PARKING;
    expect(def.assignable).toBe(false);
    expect(def.defaultSize.w).toBeGreaterThan(def.defaultSize.h);
    expect(def.category).toBe('infrastructure');
  });

  it('carries the bike skin so the glyph renders', () => {
    expect(ITEM_CATALOG.BIKE_PARKING.skin).toBe('bikeParking');
  });
});
