import { duplicateUnit } from '../../components/lodging/editor-ops';
import type { EditorUnit } from '../../components/lodging/types';

function unit(over: Partial<EditorUnit> = {}): EditorUnit {
  return {
    id: 'u1', kind: 'TENT', label: 'Sahiba',
    x: 10, y: 20, w: 10, h: 12, rotation: 0,
    color: null, partnerCamp: null, notes: null, sortOrder: 0, opacity: 1,
    dirty: false, isNew: false,
    ...over,
  };
}

describe('duplicateUnit', () => {
  it('copies kind/size, offsets + snaps position, and marks the copy new + dirty', () => {
    const copy = duplicateUnit(unit(), 1, 'u2');
    expect(copy.id).toBe('u2');
    expect(copy.kind).toBe('TENT');
    expect(copy.w).toBe(10);
    expect(copy.h).toBe(12);
    expect(copy.x).toBe(14); // 10 + 4, snapped to 1ft grid
    expect(copy.y).toBe(24);
    expect(copy.isNew).toBe(true);
    expect(copy.dirty).toBe(true);
  });

  it('snaps the offset to the grid size', () => {
    const copy = duplicateUnit(unit({ x: 10, y: 10 }), 5, 'u2');
    expect(copy.x).toBe(15); // 10 + 4 = 14 -> snapped to nearest 5 = 15
    expect(copy.y).toBe(15);
  });

  it('does not mutate the source unit', () => {
    const src = unit();
    duplicateUnit(src, 1, 'u2');
    expect(src.id).toBe('u1');
    expect(src.x).toBe(10);
  });
});
