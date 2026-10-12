import { polar, azToMap, starPoints, dialTicks, isDarkHex } from '../layers/medallion';
import { shadeHex } from '../skin-geometry';

describe('polar', () => {
  it('puts 0° straight up and 90° to the right', () => {
    const [x0, y0] = polar(0, 10);
    expect(x0).toBeCloseTo(0);
    expect(y0).toBeCloseTo(-10);
    const [x90, y90] = polar(90, 10);
    expect(x90).toBeCloseTo(10);
    expect(y90).toBeCloseTo(0);
  });
});

describe('azToMap', () => {
  it('subtracts the frontage bearing from a true azimuth', () => {
    expect(azToMap(0, 157.5)).toBeCloseTo(-157.5);
    expect(azToMap(235, 157.5)).toBeCloseTo(77.5);
  });
});

describe('starPoints', () => {
  it('emits 2n vertices alternating outer and inner radius', () => {
    const pts = starPoints(40, 17).split(' ').map((p) => p.split(',').map(Number));
    expect(pts).toHaveLength(16);
    const radii = pts.map(([x, y]) => Math.hypot(x, y));
    expect(radii[0]).toBeCloseTo(40, 1);
    expect(radii[1]).toBeCloseTo(17, 1);
  });
});

describe('dialTicks', () => {
  it('marks every 90° as cardinal', () => {
    const ticks = dialTicks(30);
    expect(ticks).toHaveLength(12);
    expect(ticks.filter((t) => t.cardinal).map((t) => t.angle)).toEqual([0, 90, 180, 270]);
  });
});

describe('isDarkHex', () => {
  it('detects dark and light fabrics', () => {
    expect(isDarkHex('#4A4E52')).toBe(true);
    expect(isDarkHex('#E9E7E0')).toBe(false);
  });
});

describe('shadeHex', () => {
  it('darkens toward black and lightens toward white', () => {
    expect(shadeHex('#808080', -1)).toBe('#000000');
    expect(shadeHex('#808080', 1)).toBe('#ffffff');
    expect(shadeHex('#ffffff', -0.5)).toBe('#808080');
  });
  it('passes through invalid input', () => {
    expect(shadeHex('nope', -0.5)).toBe('nope');
  });
});
