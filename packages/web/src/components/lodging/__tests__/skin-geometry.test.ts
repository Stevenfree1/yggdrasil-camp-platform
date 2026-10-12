import {
  hexagonPoints,
  trefoilPoints,
  insetPolygon,
  ribPositions,
  gridLinePositions,
  latticeCells,
  BOTEH_PATH,
  hatchSegment,
} from '../skin-geometry';

describe('hexagonPoints', () => {
  it('returns 6 vertices within the bounding box', () => {
    const pts = hexagonPoints(120, 120);
    expect(pts).toHaveLength(12);
    for (let i = 0; i < 12; i += 2) {
      expect(pts[i]).toBeGreaterThanOrEqual(0);
      expect(pts[i]).toBeLessThanOrEqual(120);
      expect(pts[i + 1]).toBeGreaterThanOrEqual(0);
      expect(pts[i + 1]).toBeLessThanOrEqual(120);
    }
  });

  it('is left-right symmetric', () => {
    const pts = hexagonPoints(120, 100);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const mirrored = xs.map((x) => 120 - x).sort((a, b) => a - b);
    expect(mirrored).toEqual([...xs].sort((a, b) => a - b));
  });
});

describe('trefoilPoints', () => {
  it('returns steps vertices, all inside the box', () => {
    const pts = trefoilPoints(180, 180, 48);
    expect(pts).toHaveLength(96);
    for (let i = 0; i < pts.length; i += 2) {
      expect(pts[i]).toBeGreaterThanOrEqual(0);
      expect(pts[i]).toBeLessThanOrEqual(180);
      expect(pts[i + 1]).toBeGreaterThanOrEqual(0);
      expect(pts[i + 1]).toBeLessThanOrEqual(180);
    }
  });

  it('has three lobes: radius from center peaks 3 times', () => {
    const pts = trefoilPoints(180, 180, 96);
    const cx = 90;
    const cy = 90;
    const radii: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      radii.push(Math.hypot(pts[i] - cx, pts[i + 1] - cy));
    }
    let peaks = 0;
    for (let i = 0; i < radii.length; i++) {
      const prev = radii[(i - 1 + radii.length) % radii.length];
      const next = radii[(i + 1) % radii.length];
      if (radii[i] > prev && radii[i] >= next) peaks++;
    }
    expect(peaks).toBe(3);
  });
});

describe('insetPolygon', () => {
  it('shrinks points toward the centroid', () => {
    const square = [0, 0, 10, 0, 10, 10, 0, 10];
    expect(insetPolygon(square, 0.5)).toEqual([2.5, 2.5, 7.5, 2.5, 7.5, 7.5, 2.5, 7.5]);
  });
});

describe('ribPositions', () => {
  it('spaces ribs evenly with half-pitch margins', () => {
    const ribs = ribPositions(120, 6);
    expect(ribs[0]).toBeCloseTo(3);
    expect(ribs[ribs.length - 1]).toBeCloseTo(117);
    expect(ribs[1] - ribs[0]).toBeCloseTo(6);
  });
});

describe('gridLinePositions', () => {
  it('excludes edges and covers interior at cell pitch', () => {
    expect(gridLinePositions(120, 30)).toEqual([30, 60, 90]);
  });

  it('handles non-multiple sizes without an edge-touching line', () => {
    const lines = gridLinePositions(100, 30);
    expect(lines).toEqual([30, 60, 90]);
    expect(lines.every((l) => l > 0 && l < 100)).toBe(true);
  });
});

describe('latticeCells', () => {
  it('tiles the full area', () => {
    const cells = latticeCells(60, 40, 30);
    const area = cells.reduce((s, c) => s + c.w * c.h, 0);
    expect(area).toBeCloseTo(60 * 40);
  });
});

describe('BOTEH_PATH', () => {
  it('is a closed SVG path', () => {
    expect(BOTEH_PATH.startsWith('M')).toBe(true);
    expect(BOTEH_PATH.trim().endsWith('Z')).toBe(true);
  });
});

describe('hatchSegment', () => {
  const W = 180;
  const H = 90;

  it('keeps every point inside the box, across the whole sweep', () => {
    for (const dir of [1, -1] as const) {
      for (let d = -H; d < W; d += 3) {
        const seg = hatchSegment(d, W, H, dir);
        if (!seg) continue;
        const [x1, y1, x2, y2] = seg;
        for (const x of [x1, x2]) {
          expect(x).toBeGreaterThanOrEqual(-1e-9);
          expect(x).toBeLessThanOrEqual(W + 1e-9);
        }
        for (const y of [y1, y2]) {
          expect(y).toBeGreaterThanOrEqual(-1e-9);
          expect(y).toBeLessThanOrEqual(H + 1e-9);
        }
      }
    }
  });

  it('drops lines that miss the box', () => {
    expect(hatchSegment(-H - 10, W, H, 1)).toBeNull();
    expect(hatchSegment(W + 10, W, H, 1)).toBeNull();
  });

  it('spans the full diagonal when the line crosses the middle', () => {
    const seg = hatchSegment(0, W, H, 1)!;
    expect(seg).toEqual([0, 0, H, H]);
  });

  it('stays 45 degrees after clipping', () => {
    for (let d = -H; d < W; d += 7) {
      const seg = hatchSegment(d, W, H, 1);
      if (!seg) continue;
      const [x1, y1, x2, y2] = seg;
      expect(Math.abs(Math.abs(x2 - x1) - Math.abs(y2 - y1))).toBeLessThan(1e-9);
    }
  });
});
