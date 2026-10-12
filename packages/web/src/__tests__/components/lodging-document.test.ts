import {
  applyOp,
  applyOps,
  dbUnitsToDocument,
  diffDocuments,
  type MapDocument,
  type MapUnit,
} from '../../components/lodging/document';

function unit(over: Partial<MapUnit> = {}): MapUnit {
  return {
    id: 'u1', kind: 'TENT', label: null,
    x: 0, y: 0, w: 10, h: 12, rotation: 0,
    color: null, partnerCamp: null, notes: null, sortOrder: 0, opacity: 1,
    ...over,
  };
}

function doc(units: MapUnit[]): MapDocument {
  return { units };
}

describe('applyOp', () => {
  it('addUnit appends a unit without mutating the input doc', () => {
    const before = doc([unit({ id: 'a' })]);
    const after = applyOp(before, { type: 'addUnit', unit: unit({ id: 'b', kind: 'RV' }) });
    expect(after.units.map((u) => u.id)).toEqual(['a', 'b']);
    expect(before.units).toHaveLength(1); // immutable
  });

  it('addUnit rejects a duplicate id', () => {
    const before = doc([unit({ id: 'a' })]);
    expect(() => applyOp(before, { type: 'addUnit', unit: unit({ id: 'a' }) })).toThrow(/exists/i);
  });

  it('moveUnit updates x/y and throws on unknown id', () => {
    const before = doc([unit({ id: 'a', x: 1, y: 2 })]);
    const after = applyOp(before, { type: 'moveUnit', id: 'a', x: 5, y: 9 });
    expect(after.units[0]).toMatchObject({ x: 5, y: 9 });
    expect(() => applyOp(before, { type: 'moveUnit', id: 'z', x: 0, y: 0 })).toThrow(/not found/i);
  });

  it('resizeUnit updates w/h', () => {
    const after = applyOp(doc([unit({ id: 'a' })]), { type: 'resizeUnit', id: 'a', w: 8, h: 20 });
    expect(after.units[0]).toMatchObject({ w: 8, h: 20 });
  });

  it('rotateUnit sets rotation', () => {
    const after = applyOp(doc([unit({ id: 'a' })]), { type: 'rotateUnit', id: 'a', rotation: 45 });
    expect(after.units[0].rotation).toBe(45);
  });

  it('relabelUnit and recolorUnit set label/color (including null)', () => {
    let d = applyOp(doc([unit({ id: 'a', label: 'old' })]), { type: 'relabelUnit', id: 'a', label: 'Sahiba' });
    expect(d.units[0].label).toBe('Sahiba');
    d = applyOp(d, { type: 'recolorUnit', id: 'a', color: '#D4AF37' });
    expect(d.units[0].color).toBe('#D4AF37');
    d = applyOp(d, { type: 'relabelUnit', id: 'a', label: null });
    expect(d.units[0].label).toBeNull();
  });

  it('updateUnit applies a partial patch', () => {
    const after = applyOp(doc([unit({ id: 'a' })]), {
      type: 'updateUnit', id: 'a', patch: { notes: 'near banquet hall', partnerCamp: 'Neighbors' },
    });
    expect(after.units[0]).toMatchObject({ notes: 'near banquet hall', partnerCamp: 'Neighbors' });
  });

  it('deleteUnit removes the unit and throws on unknown id', () => {
    const after = applyOp(doc([unit({ id: 'a' }), unit({ id: 'b' })]), { type: 'deleteUnit', id: 'a' });
    expect(after.units.map((u) => u.id)).toEqual(['b']);
    expect(() => applyOp(after, { type: 'deleteUnit', id: 'a' })).toThrow(/not found/i);
  });

  it('reorderUnit front/back assigns the highest/lowest sortOrder', () => {
    const before = doc([
      unit({ id: 'a', sortOrder: 0 }),
      unit({ id: 'b', sortOrder: 1 }),
      unit({ id: 'c', sortOrder: 2 }),
    ]);
    const front = applyOp(before, { type: 'reorderUnit', id: 'a', dir: 'front' });
    expect(front.units.find((u) => u.id === 'a')!.sortOrder).toBeGreaterThan(2);
    const back = applyOp(before, { type: 'reorderUnit', id: 'c', dir: 'back' });
    expect(back.units.find((u) => u.id === 'c')!.sortOrder).toBeLessThan(0);
  });
});

describe('applyOps', () => {
  it('applies a sequence of ops in order', () => {
    const result = applyOps(doc([]), [
      { type: 'addUnit', unit: unit({ id: 'a', kind: 'SHIFTPOD' }) },
      { type: 'moveUnit', id: 'a', x: 30, y: 40 },
      { type: 'relabelUnit', id: 'a', label: 'Pod 1' },
    ]);
    expect(result.units).toHaveLength(1);
    expect(result.units[0]).toMatchObject({ kind: 'SHIFTPOD', x: 30, y: 40, label: 'Pod 1' });
  });
});

describe('dbUnitsToDocument', () => {
  it('maps DB rows to MapUnits, dropping non-document fields', () => {
    const rows = [{
      id: 'a', seasonId: 's', kind: 'TENT', label: 'x',
      x: 1, y: 2, w: 10, h: 12, rotation: 0,
      color: null, partnerCamp: null, notes: null, sortOrder: 3, opacity: 0.5,
      createdAt: new Date(0), updatedAt: new Date(0),
    }];
    const document = dbUnitsToDocument(rows as never);
    expect(document.units).toHaveLength(1);
    expect(document.units[0]).toEqual({
      id: 'a', kind: 'TENT', label: 'x', x: 1, y: 2, w: 10, h: 12,
      rotation: 0, color: null, partnerCamp: null, notes: null, sortOrder: 3, opacity: 0.5,
    });
    expect(document.units[0]).not.toHaveProperty('seasonId');
    expect(document.units[0]).not.toHaveProperty('createdAt');
  });
});

describe('diffDocuments', () => {
  it('classifies created, updated, and deleted units', () => {
    const before = doc([unit({ id: 'a', x: 0 }), unit({ id: 'b' })]);
    const after = doc([unit({ id: 'a', x: 5 }), unit({ id: 'c', kind: 'RV' })]);
    const diff = diffDocuments(before, after);
    expect(diff.created.map((u) => u.id)).toEqual(['c']);
    expect(diff.updated.map((u) => u.id)).toEqual(['a']);
    expect(diff.deletedIds).toEqual(['b']);
  });

  it('reports no changes when documents are identical', () => {
    const before = doc([unit({ id: 'a' })]);
    const diff = diffDocuments(before, doc([unit({ id: 'a' })]));
    expect(diff.created).toEqual([]);
    expect(diff.updated).toEqual([]);
    expect(diff.deletedIds).toEqual([]);
  });
});
