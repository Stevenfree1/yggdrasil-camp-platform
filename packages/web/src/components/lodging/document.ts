import type { LodgingUnitKind } from '@prisma/client';

/**
 * The clean, serialisable representation of a camp map — the structured
 * document that the editor renders and that a future agent / MCP tool drives
 * through the {@link MapOp} vocabulary. It is intentionally free of UI state
 * (no `dirty`/`isNew` flags) and of DB bookkeeping (no `seasonId`/timestamps).
 */
export interface MapUnit {
  id: string;
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
}

export interface MapDocument {
  units: MapUnit[];
}

/** The canonical edit vocabulary. Every map mutation is expressible as a MapOp. */
export type MapOp =
  | { type: 'addUnit'; unit: MapUnit }
  | { type: 'updateUnit'; id: string; patch: Partial<Omit<MapUnit, 'id'>> }
  | { type: 'moveUnit'; id: string; x: number; y: number }
  | { type: 'resizeUnit'; id: string; w: number; h: number }
  | { type: 'rotateUnit'; id: string; rotation: number }
  | { type: 'relabelUnit'; id: string; label: string | null }
  | { type: 'recolorUnit'; id: string; color: string | null }
  | { type: 'reorderUnit'; id: string; dir: 'front' | 'back' | 'forward' | 'backward' }
  | { type: 'deleteUnit'; id: string };

/** Apply `fn` to the unit with `id`, returning a new document. Throws if absent. */
function withUnit(doc: MapDocument, id: string, fn: (u: MapUnit) => MapUnit): MapDocument {
  let found = false;
  const units = doc.units.map((u) => {
    if (u.id !== id) return u;
    found = true;
    return fn(u);
  });
  if (!found) throw new Error(`Unit not found: ${id}`);
  return { ...doc, units };
}

/** Pure: apply one operation, returning a new MapDocument (never mutates input). */
export function applyOp(doc: MapDocument, op: MapOp): MapDocument {
  switch (op.type) {
    case 'addUnit':
      if (doc.units.some((u) => u.id === op.unit.id)) {
        throw new Error(`Unit already exists: ${op.unit.id}`);
      }
      return { ...doc, units: [...doc.units, op.unit] };
    case 'updateUnit':
      return withUnit(doc, op.id, (u) => ({ ...u, ...op.patch }));
    case 'moveUnit':
      return withUnit(doc, op.id, (u) => ({ ...u, x: op.x, y: op.y }));
    case 'resizeUnit':
      return withUnit(doc, op.id, (u) => ({ ...u, w: op.w, h: op.h }));
    case 'rotateUnit':
      return withUnit(doc, op.id, (u) => ({ ...u, rotation: op.rotation }));
    case 'relabelUnit':
      return withUnit(doc, op.id, (u) => ({ ...u, label: op.label }));
    case 'recolorUnit':
      return withUnit(doc, op.id, (u) => ({ ...u, color: op.color }));
    case 'reorderUnit': {
      const orders = doc.units.map((u) => u.sortOrder);
      const max = orders.length ? Math.max(...orders) : 0;
      const min = orders.length ? Math.min(...orders) : 0;
      return withUnit(doc, op.id, (u) => {
        switch (op.dir) {
          case 'front':
            return { ...u, sortOrder: max + 1 };
          case 'back':
            return { ...u, sortOrder: min - 1 };
          case 'forward':
            return { ...u, sortOrder: u.sortOrder + 1 };
          case 'backward':
            return { ...u, sortOrder: u.sortOrder - 1 };
        }
      });
    }
    case 'deleteUnit':
      if (!doc.units.some((u) => u.id === op.id)) {
        throw new Error(`Unit not found: ${op.id}`);
      }
      return { ...doc, units: doc.units.filter((u) => u.id !== op.id) };
  }
}

/** Pure: apply a sequence of operations left-to-right. */
export function applyOps(doc: MapDocument, ops: MapOp[]): MapDocument {
  return ops.reduce(applyOp, doc);
}

/** Project DB rows (which carry seasonId/timestamps) down to a MapDocument. */
export function dbUnitsToDocument(units: ReadonlyArray<MapUnit>): MapDocument {
  return {
    units: units.map((u) => ({
      id: u.id,
      kind: u.kind,
      label: u.label,
      x: u.x,
      y: u.y,
      w: u.w,
      h: u.h,
      rotation: u.rotation,
      color: u.color,
      partnerCamp: u.partnerCamp,
      notes: u.notes,
      sortOrder: u.sortOrder,
      opacity: u.opacity,
    })),
  };
}

const DOC_FIELDS: Array<keyof MapUnit> = [
  'kind', 'label', 'x', 'y', 'w', 'h', 'rotation', 'color', 'partnerCamp', 'notes', 'sortOrder', 'opacity',
];

function unitsEqual(a: MapUnit, b: MapUnit): boolean {
  return DOC_FIELDS.every((k) => a[k] === b[k]);
}

export interface DocumentDiff {
  created: MapUnit[];
  updated: MapUnit[];
  deletedIds: string[];
}

/**
 * Compute the minimal create/update/delete set to turn `before` into `after`.
 * Drives the `applyOps` persistence path: only changed rows are written.
 */
export function diffDocuments(before: MapDocument, after: MapDocument): DocumentDiff {
  const beforeById = new Map(before.units.map((u) => [u.id, u]));
  const afterIds = new Set(after.units.map((u) => u.id));
  const created: MapUnit[] = [];
  const updated: MapUnit[] = [];
  for (const u of after.units) {
    const prev = beforeById.get(u.id);
    if (!prev) created.push(u);
    else if (!unitsEqual(prev, u)) updated.push(u);
  }
  const deletedIds = before.units.filter((u) => !afterIds.has(u.id)).map((u) => u.id);
  return { created, updated, deletedIds };
}
