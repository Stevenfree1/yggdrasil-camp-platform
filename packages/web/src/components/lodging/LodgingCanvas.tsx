'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Text, Shape, Group, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { EditorUnit, PX_PER_FT, GRID_COLOR, GRID_MAJOR_COLOR, snap } from './types';
import { LodgingUnitShape } from './LodgingUnitShape';
import { isPowerLayerKind } from './catalog';
import { MAP_STREET_WIDTH_FT } from '../../lib/lodging-export';

interface BackgroundConfig {
  url: string;
  opacity: number;
  scale: number;
  /** Top-left of the *unrotated* image, in world feet. */
  x: number;
  y: number;
  /** Degrees clockwise about the image centre. */
  rotation?: number;
}

/** A locked, street-anchored play area: the grid fills it; streets pin its edges. */
export interface SiteFrame {
  widthFt: number;
  depthFt: number;
  streetTop: string | null;
  streetBottom: string | null;
  streetRight?: string | null;
}

export interface LodgingCanvasHandle {
  /** Returns a PNG data URL of the current stage view at the requested pixel ratio. */
  /**
   * PNG of the stage. Pass `cropFt` (world feet) to crop to exactly that region
   * — without it the export carries the viewport's empty margins, which for a
   * tall camp in a wide viewport is most of the image.
   */
  exportPng: (
    pixelRatio?: number,
    cropFt?: { minX: number; minY: number; maxX: number; maxY: number },
  ) => string | null;
  /** Converts an absolute (clientX, clientY) screen point to world feet. */
  screenToWorld: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** Returns the world-feet coordinates at the center of the current viewport. */
  viewportCenterFt: () => { x: number; y: number } | null;
  /** Auto-fit zoom + pan so the given world-feet bounding box fills the viewport. */
  fitToBounds: (minX: number, minY: number, maxX: number, maxY: number, paddingFt?: number) => void;
  /** On-screen pixels per foot at the current zoom (for export scale bars). */
  getPxPerFt: () => number;
  /**
   * Footprint of the background reference image in world feet, or null when no
   * background is set / still loading. Export uses this so a reference image
   * placed outside the site frame (e.g. the partner camp below us) is not
   * cropped out of the PNG.
   */
  getBackgroundBoundsFt: () => { minX: number; minY: number; maxX: number; maxY: number } | null;
  /** Snapshot the current pan/zoom so it can be restored after an export. */
  getViewState: () => { x: number; y: number; scale: number } | null;
  setViewState: (v: { x: number; y: number; scale: number }) => void;
  /** Rotate the on-screen view 90° about the viewport center. Non-destructive:
   *  unit coordinates never change — only the camera spins. */
  rotateView: (dir: 'cw' | 'ccw') => void;
}

interface Props {
  units: EditorUnit[];
  selectedIds?: Set<string>;
  gridSizeFt: number;
  occupantLabels: Record<string, string>; // unit.id -> name string
  fillOverrides: Record<string, string>; // unit.id -> hex color
  background?: BackgroundConfig | null;
  site?: SiteFrame | null;
  width: number;
  height: number;
  onSelect?: (id: string | null, additive?: boolean) => void;
  onMarqueeSelect?: (ids: string[], additive: boolean) => void;
  onGroupMove?: (moves: Array<{ id: string; x: number; y: number }>) => void;
  onChange: (id: string, patch: Partial<EditorUnit>) => void;
  readOnly?: boolean;
  highlightId?: string | null;
  /** Power layer: gold rings around power boxes and generator units. */
  powerHighlight?: boolean;
  /**
   * Whether power plugs are drawn. Plugs exist for the power company, so they
   * only appear while the Power layer is on — otherwise they clutter the camp
   * layout everyone else works from.
   */
  showPlugs?: boolean;
  /**
   * Background positioning mode. The reference image becomes draggable against
   * the live camp layout — the only way to line a neighbour's map up with our
   * own units is to see both while moving one.
   */
  backgroundEditable?: boolean;
  /** Reports the dragged background's new top-left corner, in world feet. */
  onBackgroundMove?: (xFt: number, yFt: number) => void;
}

const EMPTY_SELECTION: Set<string> = new Set();
const NEIGHBOR_SNAP_FT = 1.5; // snap to other unit edges within this distance

// View rotation is constrained to 90° steps, so rotating a screen-space vector
// is a cheap axis swap (no trig). Konva rotation is clockwise-positive in the
// y-down canvas, which these match.
function rotVec(vx: number, vy: number, deg: number): [number, number] {
  const d = ((deg % 360) + 360) % 360;
  switch (d) {
    case 90: return [-vy, vx];
    case 180: return [-vx, -vy];
    case 270: return [vy, -vx];
    default: return [vx, vy];
  }
}

/**
 * Screen px (relative to the stage container) → world px, inverting the stage
 * pan/zoom/rotation. The stage transform is translate(pos) ∘ rotate ∘ scale, so
 * the inverse is rotate⁻¹ then unscale. Used by every screen↔world conversion so
 * interactions stay correct at any view rotation.
 */
function screenToWorldPx(sx: number, sy: number, posX: number, posY: number, scale: number, rotDeg: number) {
  const [rx, ry] = rotVec(sx - posX, sy - posY, -rotDeg);
  return { x: rx / scale, y: ry / scale };
}

/**
 * If any edge of (x, y, w, h) is within NEIGHBOR_SNAP_FT of any edge of
 * another unit, returns the nearest aligned position. Used after grid snap
 * to make adjacent units line up cleanly.
 */
function snapToNeighborEdges(
  x: number, y: number, w: number, h: number,
  others: Array<{ x: number; y: number; w: number; h: number }>,
): { x: number; y: number } {
  const myXs = [x, x + w];
  const myYs = [y, y + h];
  let bestXAdj = 0;
  let bestXDist = NEIGHBOR_SNAP_FT;
  let bestYAdj = 0;
  let bestYDist = NEIGHBOR_SNAP_FT;
  for (const o of others) {
    const otherXs = [o.x, o.x + o.w];
    const otherYs = [o.y, o.y + o.h];
    for (const mx of myXs) {
      for (const ox of otherXs) {
        const d = Math.abs(mx - ox);
        if (d < bestXDist) {
          bestXDist = d;
          bestXAdj = ox - mx;
        }
      }
    }
    for (const my of myYs) {
      for (const oy of otherYs) {
        const d = Math.abs(my - oy);
        if (d < bestYDist) {
          bestYDist = d;
          bestYAdj = oy - my;
        }
      }
    }
  }
  return { x: x + bestXAdj, y: y + bestYAdj };
}


export const LodgingCanvas = forwardRef<LodgingCanvasHandle, Props>(function LodgingCanvas({
  units,
  selectedIds = EMPTY_SELECTION,
  gridSizeFt,
  occupantLabels,
  fillOverrides,
  background,
  site = null,
  width,
  height,
  onSelect,
  onMarqueeSelect,
  onGroupMove,
  onChange,
  readOnly = false,
  highlightId = null,
  powerHighlight = false,
  showPlugs = false,
  backgroundEditable = false,
  onBackgroundMove,
}, handleRef) {
  const stageRef = useRef<Konva.Stage>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [cursorFt, setCursorFt] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingCursor = useRef<{ x: number; y: number } | null>(null);

  // Multi-select plumbing: node registry (for imperative group drag), marquee state.
  const nodeRegistry = useRef<Map<string, Konva.Group>>(new Map());
  const registerNode = useRef((id: string, node: Konva.Group | null) => {
    if (node) nodeRegistry.current.set(id, node);
    else nodeRegistry.current.delete(id);
  }).current;
  const groupDragStarts = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [shiftHeld, setShiftHeld] = useState(false);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Group drag: when one selected unit is dragged, move the rest by the same delta.
  const handleGroupDragStart = (id: string) => {
    const starts = new Map<string, { x: number; y: number }>();
    selectedIds.forEach((sid) => {
      const n = nodeRegistry.current.get(sid);
      if (n) starts.set(sid, { x: n.x(), y: n.y() });
    });
    groupDragStarts.current = starts;
  };
  const handleGroupDragMove = (id: string) => {
    const dragged = nodeRegistry.current.get(id);
    const ds = groupDragStarts.current.get(id);
    if (!dragged || !ds) return;
    const dx = dragged.x() - ds.x;
    const dy = dragged.y() - ds.y;
    groupDragStarts.current.forEach((start, sid) => {
      if (sid === id) return;
      const n = nodeRegistry.current.get(sid);
      if (n) n.position({ x: start.x + dx, y: start.y + dy });
    });
    dragged.getLayer()?.batchDraw();
  };
  const handleGroupDragEnd = () => {
    const moves: Array<{ id: string; x: number; y: number }> = [];
    groupDragStarts.current.forEach((_s, sid) => {
      const n = nodeRegistry.current.get(sid);
      if (!n) return;
      const fx = snap(n.x() / PX_PER_FT, gridSizeFt);
      const fy = snap(n.y() / PX_PER_FT, gridSizeFt);
      n.position({ x: fx * PX_PER_FT, y: fy * PX_PER_FT });
      moves.push({ id: sid, x: fx, y: fy });
    });
    groupDragStarts.current = new Map();
    if (moves.length && onGroupMove) onGroupMove(moves);
  };

  // Load background image from URL when it changes.
  useEffect(() => {
    if (!background?.url) {
      setBgImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setBgImage(img);
    img.onerror = () => setBgImage(null);
    img.src = background.url;
  }, [background?.url]);

  useImperativeHandle(handleRef, () => ({
    exportPng: (pixelRatio = 2, cropFt) => {
      const stage = stageRef.current;
      if (!stage) return null;
      if (!cropFt) return stage.toDataURL({ mimeType: 'image/png', pixelRatio });

      // World feet → stage-container pixels, for all four corners so the crop
      // stays correct when the view is rotated 90/180/270.
      const scale = stage.scaleX();
      const rot = stage.rotation();
      const corners = [
        [cropFt.minX, cropFt.minY],
        [cropFt.maxX, cropFt.minY],
        [cropFt.maxX, cropFt.maxY],
        [cropFt.minX, cropFt.maxY],
      ].map(([fx, fy]) => {
        const [rx, ry] = rotVec(fx * PX_PER_FT * scale, fy * PX_PER_FT * scale, rot);
        return [rx + stage.x(), ry + stage.y()] as const;
      });
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const x = Math.floor(Math.min(...xs));
      const y = Math.floor(Math.min(...ys));
      const width = Math.ceil(Math.max(...xs) - x);
      const height = Math.ceil(Math.max(...ys) - y);
      if (width < 2 || height < 2) return stage.toDataURL({ mimeType: 'image/png', pixelRatio });
      return stage.toDataURL({ mimeType: 'image/png', pixelRatio, x, y, width, height });
    },
    screenToWorld: (clientX, clientY) => {
      const stage = stageRef.current;
      if (!stage) return null;
      const rect = stage.container().getBoundingClientRect();
      const w = screenToWorldPx(clientX - rect.left, clientY - rect.top, stage.x(), stage.y(), stage.scaleX(), stage.rotation());
      return { x: w.x / PX_PER_FT, y: w.y / PX_PER_FT };
    },
    viewportCenterFt: () => {
      const stage = stageRef.current;
      if (!stage) return null;
      const rect = stage.container().getBoundingClientRect();
      const w = screenToWorldPx(rect.width / 2, rect.height / 2, stage.x(), stage.y(), stage.scaleX(), stage.rotation());
      return { x: w.x / PX_PER_FT, y: w.y / PX_PER_FT };
    },
    getBackgroundBoundsFt: () => {
      if (!bgImage || !background) return null;
      const w = (bgImage.width * background.scale) / PX_PER_FT;
      const h = (bgImage.height * background.scale) / PX_PER_FT;
      const cx = background.x + w / 2;
      const cy = background.y + h / 2;
      // Axis-aligned box of the rotated rectangle, so export still crops to the
      // whole reference image once it has been turned to match the camp.
      const r = ((background.rotation ?? 0) * Math.PI) / 180;
      const c = Math.abs(Math.cos(r));
      const s = Math.abs(Math.sin(r));
      const hw = (w / 2) * c + (h / 2) * s;
      const hh = (w / 2) * s + (h / 2) * c;
      return { minX: cx - hw, minY: cy - hh, maxX: cx + hw, maxY: cy + hh };
    },
    fitToBounds: (minX, minY, maxX, maxY, paddingFt = 20) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rot = stage.rotation();
      const padded = {
        minX: minX - paddingFt,
        minY: minY - paddingFt,
        maxX: maxX + paddingFt,
        maxY: maxY + paddingFt,
      };
      const contentW = (padded.maxX - padded.minX) * PX_PER_FT;
      const contentH = (padded.maxY - padded.minY) * PX_PER_FT;
      const rect = stage.container().getBoundingClientRect();
      // At 90°/270° the content's on-screen width/height swap.
      const rot90 = rot === 90 || rot === 270;
      const effW = rot90 ? contentH : contentW;
      const effH = rot90 ? contentW : contentH;
      const scale = Math.min(rect.width / effW, rect.height / effH);
      const clamped = Math.max(0.2, Math.min(4, scale));
      // Place the content's world-px center at the viewport center under rotation.
      const wcx = ((padded.minX + padded.maxX) / 2) * PX_PER_FT;
      const wcy = ((padded.minY + padded.maxY) / 2) * PX_PER_FT;
      const [rvx, rvy] = rotVec(wcx * clamped, wcy * clamped, rot);
      setStageScale(clamped);
      setStagePos({ x: rect.width / 2 - rvx, y: rect.height / 2 - rvy });
    },
    rotateView: (dir) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.container().getBoundingClientRect();
      const s = stage.scaleX();
      const curR = stage.rotation();
      // Keep whatever sits under the viewport centre fixed across the rotation.
      const w = screenToWorldPx(rect.width / 2, rect.height / 2, stage.x(), stage.y(), s, curR);
      const newR = (((curR + (dir === 'cw' ? 90 : -90)) % 360) + 360) % 360;
      const [rvx, rvy] = rotVec(w.x * s, w.y * s, newR);
      setViewRotation(newR);
      setStagePos({ x: rect.width / 2 - rvx, y: rect.height / 2 - rvy });
    },
    getPxPerFt: () => {
      const stage = stageRef.current;
      return PX_PER_FT * (stage ? stage.scaleX() : 1);
    },
    getViewState: () => {
      const stage = stageRef.current;
      if (!stage) return null;
      return { x: stage.x(), y: stage.y(), scale: stage.scaleX() };
    },
    setViewState: (v) => {
      setStageScale(v.scale);
      setStagePos({ x: v.x, y: v.y });
    },
  }), []);
  const [stagePos, setStagePos] = useState({ x: 20, y: 20 });
  const [stageScale, setStageScale] = useState(1);
  const [viewRotation, setViewRotation] = useState(0); // 0 | 90 | 180 | 270 — view only

  // Wheel: two-finger scroll / wheel pans (the map-native expectation); pinch or
  // ⌘/Ctrl+wheel zooms around the cursor. deltaMode 1 (lines) is scaled up.
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    if (e.evt.ctrlKey || e.evt.metaKey) {
      // Zoom around the cursor (held fixed across the zoom, under rotation).
      const oldScale = stageScale;
      const world = screenToWorldPx(pointer.x, pointer.y, stagePos.x, stagePos.y, oldScale, viewRotation);
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const scaleBy = 1.08;
      const newScale = Math.max(0.2, Math.min(4, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy));
      const [rvx, rvy] = rotVec(world.x * newScale, world.y * newScale, viewRotation);
      setStageScale(newScale);
      setStagePos({ x: pointer.x - rvx, y: pointer.y - rvy });
      return;
    }
    // Pan: shift+wheel maps a vertical wheel to horizontal (mouse-wheel users).
    const unit = e.evt.deltaMode === 1 ? 16 : 1;
    let dx = e.evt.deltaX * unit;
    let dy = e.evt.deltaY * unit;
    if (e.evt.shiftKey && dx === 0) { dx = dy; dy = 0; }
    setStagePos((p) => ({ x: p.x - dx, y: p.y - dy }));
  };

  // Empty-stage mousedown: Shift starts a marquee, otherwise deselect (+ pan).
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current;
    const isEmpty = e.target === e.target.getStage();
    if (isEmpty && shiftHeld && !readOnly) {
      const pos = stage?.getPointerPosition();
      if (stage && pos) {
        const w = screenToWorldPx(pos.x, pos.y, stage.x(), stage.y(), stage.scaleX(), stage.rotation());
        marqueeStart.current = { x: w.x, y: w.y };
        setMarquee({ x0: w.x, y0: w.y, x1: w.x, y1: w.y });
      }
      return;
    }
    if (isEmpty) onSelect?.(null);
  };

  // Finish a marquee: select all units intersecting the box.
  const handleStageMouseUp = () => {
    if (marqueeStart.current && marquee) {
      const minXft = Math.min(marquee.x0, marquee.x1) / PX_PER_FT;
      const maxXft = Math.max(marquee.x0, marquee.x1) / PX_PER_FT;
      const minYft = Math.min(marquee.y0, marquee.y1) / PX_PER_FT;
      const maxYft = Math.max(marquee.y0, marquee.y1) / PX_PER_FT;
      if (maxXft - minXft > 0.5 && maxYft - minYft > 0.5) {
        const ids = units
          .filter((u) => u.x < maxXft && u.x + u.w > minXft && u.y < maxYft && u.y + u.h > minYft)
          .map((u) => u.id);
        onMarqueeSelect?.(ids, false);
      }
    }
    marqueeStart.current = null;
    setMarquee(null);
  };

  // Track cursor in world coordinates, throttled via rAF to avoid re-render storms.
  const handleStageMouseMove = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const w = screenToWorldPx(pointer.x, pointer.y, stage.x(), stage.y(), stage.scaleX(), stage.rotation());
    if (marqueeStart.current) {
      setMarquee({ x0: marqueeStart.current.x, y0: marqueeStart.current.y, x1: w.x, y1: w.y });
    }
    pendingCursor.current = { x: w.x / PX_PER_FT, y: w.y / PX_PER_FT };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        if (pendingCursor.current) setCursorFt(pendingCursor.current);
        rafRef.current = null;
      });
    }
  };
  const handleStageMouseLeave = () => {
    setCursorFt(null);
    if (marqueeStart.current) {
      marqueeStart.current = null;
      setMarquee(null);
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // Site frame size in px (the locked play area drawn on top of the grid).
  const gridWpx = (site?.widthFt ?? 0) * PX_PER_FT;
  const gridHpx = (site?.depthFt ?? 0) * PX_PER_FT;

  // Infinite grid: draw only the lines visible in the current viewport so the
  // whole canvas always shows grid, at any pan/zoom, without a fixed extent.
  // Minor lines are culled when they'd be too dense to read.
  // World-ft bounding box of the visible area: invert all four screen corners
  // (so coverage is correct at any view rotation, not just axis-aligned).
  const cornerFts = ([[0, 0], [width, 0], [0, height], [width, height]] as const).map(([sx, sy]) => {
    const w = screenToWorldPx(sx, sy, stagePos.x, stagePos.y, stageScale, viewRotation);
    return { x: w.x / PX_PER_FT, y: w.y / PX_PER_FT };
  });
  const viewMinXft = Math.min(...cornerFts.map((c) => c.x));
  const viewMaxXft = Math.max(...cornerFts.map((c) => c.x));
  const viewMinYft = Math.min(...cornerFts.map((c) => c.y));
  const viewMaxYft = Math.max(...cornerFts.map((c) => c.y));
  const showMinor = gridSizeFt * PX_PER_FT * stageScale >= 5;
  // Pad beyond the viewport so the grid still covers the edges mid-drag
  // (stage position only commits on drag end).
  const padX = (viewMaxXft - viewMinXft) * 0.75;
  const padY = (viewMaxYft - viewMinYft) * 0.75;
  const minXft = viewMinXft - padX;
  const maxXft = viewMaxXft + padX;
  const minYft = viewMinYft - padY;
  const maxYft = viewMaxYft + padY;
  const xLeftPx = minXft * PX_PER_FT;
  const xRightPx = maxXft * PX_PER_FT;
  const yTopPx = minYft * PX_PER_FT;
  const yBotPx = maxYft * PX_PER_FT;
  const startX = Math.floor(minXft / gridSizeFt) * gridSizeFt;
  const endX = Math.ceil(maxXft / gridSizeFt) * gridSizeFt;
  const startY = Math.floor(minYft / gridSizeFt) * gridSizeFt;
  const endY = Math.ceil(maxYft / gridSizeFt) * gridSizeFt;

  // Draw the whole grid in ONE Konva Shape (one canvas pass) instead of hundreds
  // of <Line> nodes — the dominant cost when panning/zooming a large plot.
  const drawGrid = (ctx: Konva.Context) => {
    const pass = (major: boolean) => {
      ctx.beginPath();
      for (let xf = startX; xf <= endX; xf += gridSizeFt) {
        if ((Math.round(xf) % 10 === 0) !== major) continue;
        const x = xf * PX_PER_FT;
        ctx.moveTo(x, yTopPx);
        ctx.lineTo(x, yBotPx);
      }
      for (let yf = startY; yf <= endY; yf += gridSizeFt) {
        if ((Math.round(yf) % 10 === 0) !== major) continue;
        const y = yf * PX_PER_FT;
        ctx.moveTo(xLeftPx, y);
        ctx.lineTo(xRightPx, y);
      }
      ctx.strokeStyle = major ? GRID_MAJOR_COLOR : GRID_COLOR;
      ctx.lineWidth = major ? 0.6 : 0.3;
      ctx.stroke();
    };
    if (showMinor) pass(false);
    pass(true);
  };

  // Keyboard delete: handled by parent (we just emit selected id, parent owns deletion)

  return (
    <>
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      x={stagePos.x}
      y={stagePos.y}
      scaleX={stageScale}
      scaleY={stageScale}
      rotation={viewRotation}
      draggable={!shiftHeld}
      onDragEnd={(e) => {
        // Only update position if it's the stage being dragged (not a child)
        if (e.target === e.target.getStage()) {
          setStagePos({ x: e.target.x(), y: e.target.y() });
        }
      }}
      onWheel={handleWheel}
      onMouseDown={handleStageMouseDown}
      onTouchStart={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
      onTouchEnd={handleStageMouseUp}
      onMouseLeave={handleStageMouseLeave}
      style={{ background: '#FAF7F2', cursor: shiftHeld ? 'crosshair' : 'grab' }}
    >
      {/* Base layer stays inert except while the background is being positioned,
          where the image group alone becomes interactive. */}
      <Layer listening={!!backgroundEditable}>
        {/* Site play area background (slightly brighter than the surround) */}
        {site && <Rect width={gridWpx} height={gridHpx} fill="#FCFAF6" listening={false} />}
        {/* Reference background image (e.g. prior-year layout export) */}
        {bgImage && background && (
          // Positioned by its centre with a matching offset, so rotation spins
          // the image in place instead of swinging it around its top-left. The
          // stored x/y stay the unrotated top-left, which is what the numeric
          // fields and the export bounds both expect.
          <Group
            x={background.x * PX_PER_FT + (bgImage.width * background.scale) / 2}
            y={background.y * PX_PER_FT + (bgImage.height * background.scale) / 2}
            offsetX={(bgImage.width * background.scale) / 2}
            offsetY={(bgImage.height * background.scale) / 2}
            rotation={background.rotation ?? 0}
            listening={!!backgroundEditable}
            draggable={!!backgroundEditable}
            onDragEnd={(e) => {
              onBackgroundMove?.(
                (e.target.x() - (bgImage.width * background.scale) / 2) / PX_PER_FT,
                (e.target.y() - (bgImage.height * background.scale) / 2) / PX_PER_FT,
              );
            }}
          >
            <KonvaImage
              image={bgImage}
              width={bgImage.width * background.scale}
              height={bgImage.height * background.scale}
              opacity={background.opacity}
              listening={!!backgroundEditable}
            />
            {/* Handle affordance: only drawn while positioning. */}
            {backgroundEditable && (
              <Rect
                width={bgImage.width * background.scale}
                height={bgImage.height * background.scale}
                stroke="#D4AF37"
                strokeWidth={2}
                dash={[10, 6]}
                listening={false}
              />
            )}
          </Group>
        )}
        <Shape sceneFunc={drawGrid} listening={false} perfectDrawEnabled={false} />
        {/* Locked site frame + anchored street labels */}
        {site && (
          <>
            {/* These are navigational anchors, not decorative captions. Wide
                street ribbons keep E, F, and 9:30 legible at normal zoom and
                make the surveyed camp rectangle unambiguous in exports. */}
            {site.streetTop && (
              <>
                <Rect
                  x={0}
                  y={-MAP_STREET_WIDTH_FT * PX_PER_FT}
                  width={gridWpx}
                  height={MAP_STREET_WIDTH_FT * PX_PER_FT}
                  fill="#D8C2A4"
                  stroke="#6B4A32"
                  strokeWidth={2}
                  listening={false}
                />
                <Line
                  points={[0, -MAP_STREET_WIDTH_FT * PX_PER_FT / 2, gridWpx, -MAP_STREET_WIDTH_FT * PX_PER_FT / 2]}
                  stroke="#FAF7F2"
                  strokeWidth={1}
                  dash={[10, 8]}
                  opacity={0.75}
                  listening={false}
                />
              </>
            )}
            {site.streetBottom && (
              <>
                <Rect
                  x={0}
                  y={gridHpx}
                  width={gridWpx}
                  height={MAP_STREET_WIDTH_FT * PX_PER_FT}
                  fill="#D8C2A4"
                  stroke="#6B4A32"
                  strokeWidth={2}
                  listening={false}
                />
                <Line
                  points={[0, gridHpx + MAP_STREET_WIDTH_FT * PX_PER_FT / 2, gridWpx, gridHpx + MAP_STREET_WIDTH_FT * PX_PER_FT / 2]}
                  stroke="#FAF7F2"
                  strokeWidth={1}
                  dash={[10, 8]}
                  opacity={0.75}
                  listening={false}
                />
              </>
            )}
            {site.streetRight && (
              <>
                <Rect
                  x={gridWpx}
                  y={0}
                  width={MAP_STREET_WIDTH_FT * PX_PER_FT}
                  height={gridHpx}
                  fill="#D8C2A4"
                  stroke="#6B4A32"
                  strokeWidth={2}
                  listening={false}
                />
                <Line
                  points={[gridWpx + MAP_STREET_WIDTH_FT * PX_PER_FT / 2, 0, gridWpx + MAP_STREET_WIDTH_FT * PX_PER_FT / 2, gridHpx]}
                  stroke="#FAF7F2"
                  strokeWidth={1}
                  dash={[10, 8]}
                  opacity={0.75}
                  listening={false}
                />
              </>
            )}
            <Rect width={gridWpx} height={gridHpx} stroke="#4A5D5A" strokeWidth={3} cornerRadius={2} listening={false} />
            {site.streetTop && (
              <Text
                x={0} y={-MAP_STREET_WIDTH_FT * PX_PER_FT} width={gridWpx}
                height={MAP_STREET_WIDTH_FT * PX_PER_FT} align="center" verticalAlign="middle"
                text={site.streetTop} fontSize={14} fontStyle="bold"
                fontFamily="Inter, sans-serif" fill="#2C2416" listening={false}
              />
            )}
            {site.streetBottom && (
              <Text
                x={0} y={gridHpx} width={gridWpx}
                height={MAP_STREET_WIDTH_FT * PX_PER_FT} align="center" verticalAlign="middle"
                text={site.streetBottom} fontSize={16} fontStyle="bold"
                fontFamily="Inter, sans-serif" fill="#2C2416" listening={false}
              />
            )}
            {site.streetRight && (
              <Text
                x={gridWpx + MAP_STREET_WIDTH_FT * PX_PER_FT}
                y={0}
                width={gridHpx}
                height={MAP_STREET_WIDTH_FT * PX_PER_FT}
                rotation={90}
                align="center"
                verticalAlign="middle"
                text={site.streetRight}
                fontSize={16}
                fontStyle="bold"
                fontFamily="Inter, sans-serif"
                fill="#2C2416"
                listening={false}
              />
            )}
          </>
        )}
      </Layer>
      <Layer>
        {powerHighlight &&
          units
            .filter((u) => u.kind === 'POWER_BOX' || /\bgen\b/i.test(u.label ?? ''))
            .map((u) => {
              const cx = (u.x + u.w / 2) * PX_PER_FT;
              const cy = (u.y + u.h / 2) * PX_PER_FT;
              const r = (Math.max(u.w, u.h) / 2 + 4) * PX_PER_FT;
              return (
                <Shape
                  key={`pw-${u.id}`}
                  listening={false}
                  sceneFunc={(ctx, shape) => {
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.setLineDash([8, 6]);
                    ctx.strokeStyle = '#D4AF37';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                    ctx.fillStrokeShape(shape);
                  }}
                />
              );
            })}
        {units.filter((u) => showPlugs || !isPowerLayerKind(u.kind)).map((unit) => {
          const isHighlight = highlightId === unit.id;
          const isDimmed = highlightId != null && !isHighlight;
          // Intercept x/y changes to apply neighbor-edge snap on top of grid snap.
          const handleChange = readOnly
            ? () => {}
            : (id: string, patch: Partial<EditorUnit>) => {
                if (patch.x != null && patch.y != null) {
                  const others = units
                    .filter((u) => u.id !== id)
                    .map((u) => ({ x: u.x, y: u.y, w: u.w, h: u.h }));
                  const w = patch.w ?? unit.w;
                  const h = patch.h ?? unit.h;
                  const snapped = snapToNeighborEdges(patch.x, patch.y, w, h, others);
                  onChange(id, { ...patch, x: snapped.x, y: snapped.y });
                  return;
                }
                onChange(id, patch);
              };
          return (
            <LodgingUnitShape
              key={unit.id}
              unit={unit}
              isSelected={!readOnly && selectedIds.has(unit.id)}
              selectionSize={selectedIds.size}
              gridSizeFt={gridSizeFt}
              occupantLabel={occupantLabels[unit.id]}
              fillOverride={
                isHighlight ? '#D4AF37' : isDimmed ? '#C9C9C966' : fillOverrides[unit.id]
              }
              readOnly={readOnly}
              registerNode={registerNode}
              onSelect={readOnly ? () => {} : (id, additive) => onSelect?.(id, additive)}
              onGroupDragStart={handleGroupDragStart}
              onGroupDragMove={handleGroupDragMove}
              onGroupDragEnd={handleGroupDragEnd}
              onChange={handleChange}
            />
          );
        })}
        {marquee && (
          <Rect
            x={Math.min(marquee.x0, marquee.x1)}
            y={Math.min(marquee.y0, marquee.y1)}
            width={Math.abs(marquee.x1 - marquee.x0)}
            height={Math.abs(marquee.y1 - marquee.y0)}
            fill="#D4AF3722"
            stroke="#D4AF37"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
    {cursorFt && (
      <div
        className="absolute bottom-2 right-2 px-2 py-1 rounded bg-ink/80 text-cream text-xs font-mono pointer-events-none"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        x: {cursorFt.x.toFixed(1)} ft · y: {cursorFt.y.toFixed(1)} ft
      </div>
    )}
    {viewRotation !== 0 && (
      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-gold/90 text-ink text-xs font-medium pointer-events-none">
        View rotated {viewRotation}°
      </div>
    )}
    </>
  );
});
