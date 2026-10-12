import { EditorUnit, snap } from './types';

/** Offset a duplicate by a small amount so it doesn't sit exactly on the source. */
const DUPLICATE_OFFSET_FT = 4;

/**
 * Build a duplicate of `unit`: same kind/size/rotation, position nudged by a
 * grid-snapped offset, and flagged as a new, unsaved, dirty unit. Pure.
 */
export function duplicateUnit(unit: EditorUnit, gridSizeFt: number, newId: string): EditorUnit {
  return {
    ...unit,
    id: newId,
    x: snap(unit.x + DUPLICATE_OFFSET_FT, gridSizeFt),
    y: snap(unit.y + DUPLICATE_OFFSET_FT, gridSizeFt),
    dirty: true,
    isNew: true,
  };
}
