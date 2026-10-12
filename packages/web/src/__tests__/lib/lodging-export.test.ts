import { getMapExportBounds, MAP_STREET_WIDTH_FT } from '../../lib/lodging-export';

describe('getMapExportBounds', () => {
  const site = {
    widthFt: 250,
    depthFt: 225,
    streetTop: true,
    streetBottom: false,
    streetRight: false,
  };
  const units = [
    { x: 10, y: 12, w: 20, h: 30 },
    { x: 510, y: 420, w: 12, h: 10 },
  ];
  const background = { minX: 0, minY: -16, maxX: 565, maxY: 466 };

  it('crops camp-only to the surveyed frame and its E, F, and 9:30 streets', () => {
    expect(MAP_STREET_WIDTH_FT).toBe(16);
    expect(getMapExportBounds('camp', site, units, background)).toEqual({
      minX: -2,
      minY: -18,
      maxX: 250,
      maxY: 225,
    });
  });

  it('includes outside units and the context image in the full map', () => {
    expect(getMapExportBounds('full', site, units, background)).toEqual({
      minX: -8,
      minY: -24,
      maxX: 573,
      maxY: 474,
    });
  });

  it('falls back to unit bounds when no site frame exists', () => {
    expect(getMapExportBounds('camp', null, [units[0]], background)).toEqual({
      minX: 2,
      minY: 4,
      maxX: 38,
      maxY: 50,
    });
  });
});
