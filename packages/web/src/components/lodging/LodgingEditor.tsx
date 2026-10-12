'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Map as MapIcon } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import {
  EditorUnit,
  KIND_DEFAULTS,
  KIND_COLORS,
  KIND_LABELS,
  LodgingUnitKind,
  MapColorMode,
  isAssignableLodgingKind,
  snap,
  defaultsForMember,
} from './types';
import {
  composeMapExport,
  getMapExportBounds,
  type MapExportScope,
} from '../../lib/lodging-export';
import { duplicateUnit } from './editor-ops';
import { LodgingCanvas, type LodgingCanvasHandle } from './LodgingCanvas';
import { LodgingToolbar } from './LodgingToolbar';
import { UnitPropertiesPanel } from './UnitPropertiesPanel';
import { MultiSelectPanel } from './MultiSelectPanel';
import { AssignmentControl } from './AssignmentControl';
import { UnplacedMembersTray } from './UnplacedMembersTray';
import { CsvImportModal } from './CsvImportModal';
import { SdrImportModal } from './SdrImportModal';
import { CampCompassOverlay } from './layers/CampCompassOverlay';
import { PowerDemandCard } from './layers/PowerDemandCard';
import { powerDemand, plugTally, type GridPowerTier } from './power-demand';
import { isPowerLayerKind } from './catalog';
import { BackgroundImageModal } from './BackgroundImageModal';
import { BackgroundAdjustPanel, type BackgroundPlacement } from './BackgroundAdjustPanel';
import { VersionsModal } from './VersionsModal';
import { getCampConfig } from '@/lib/config';

const campConfig = getCampConfig();

// 8-color palette for HOUSEHOLD mode — high-contrast on the cream canvas.
const HOUSEHOLD_PALETTE = [
  '#C95E3F', // terracotta
  '#5A8C7F', // teal-sage
  '#7B5EA7', // plum
  '#D4A537', // gold-amber
  '#B83260', // crimson
  '#3F6BA0', // dusty blue
  '#5D7A2C', // olive
  '#9F5832', // rust
];

function hashHouseholdToColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return HOUSEHOLD_PALETTE[hash % HOUSEHOLD_PALETTE.length];
}

function tempId() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

// Working-draft key. The editor stashes its units here while there are unsaved
// edits so an unexpected remount or reload restores them instead of snapping
// back to the server copy. Cleared once everything is saved.
const DRAFT_KEY = 'camp-lodging-draft-v1';

export function LodgingEditor() {
  const map = trpc.lodging.getMap.useQuery({}, {
    // The editor holds the authoritative working copy locally and adopts server
    // ids on save. Never auto-refetch (focus / reconnect / mount / stale) — that
    // would re-hydrate and wipe in-progress edits.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });
  const utils = trpc.useContext();
  // No onSuccess invalidate: a save only changes unit geometry, which we adopt
  // locally — re-hydrating here is what caused the post-save "reset" race.
  const saveUnits = trpc.lodging.saveUnits.useMutation();
  const [skippedOnSave, setSkippedOnSave] = useState(0);
  const deleteUnit = trpc.lodging.deleteUnit.useMutation({
    onSuccess: () => utils.lodging.getMap.invalidate(),
  });
  const upsertConfig = trpc.lodging.upsertConfig.useMutation();
  const upsertUnit = trpc.lodging.upsertUnit.useMutation();
  const assignMember = trpc.lodging.assignMember.useMutation();

  const [units, setUnits] = useState<EditorUnit[]>(() => {
    // Restore an unsaved working draft (survives a remount / reload) if present.
    try {
      const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(DRAFT_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as EditorUnit[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {
      /* ignore corrupt draft */
    }
    return [];
  });
  // Live mirror of `units` for the hydration effect. Units are local-authoritative
  // once loaded; didHydrateRef guards the one-time initial hydration.
  const unitsRef = useRef<EditorUnit[]>([]);
  unitsRef.current = units;
  const didHydrateRef = useRef(false);
  // Multi-select: selectedIds is the source of truth; selectedId is the derived
  // single selection used by the single-unit properties / assignment panels.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectedId = selectedIds.size === 1 ? ([...selectedIds][0] ?? null) : null;
  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIds(id ? new Set([id]) : new Set());
  }, []);
  const handleSelect = useCallback((id: string | null, additive = false) => {
    if (!id) {
      setSelectedIds(new Set());
      return;
    }
    if (!additive) {
      setSelectedIds(new Set([id]));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [colorMode, setColorMode] = useState<MapColorMode>('HOUSEHOLD');
  const [layers, setLayers] = useState<{ compass: boolean; power: boolean }>(() => {
    if (typeof window === 'undefined') return { compass: false, power: false };
    try {
      const stored = JSON.parse(localStorage.getItem('lodging-layers') ?? '{}');
      return {
        compass: stored.compass ?? Boolean(stored.windSun || stored.miniMap),
        power: Boolean(stored.power),
      };
    } catch {
      return { compass: false, power: false };
    }
  });
  const [gridSizeFt, setGridSizeFt] = useState(1);
  const [csvOpen, setCsvOpen] = useState(false);
  const [sdrOpen, setSdrOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  /**
   * Live background placement draft. Non-null only while positioning; the
   * canvas renders it in place of the saved config so dragging and the sliders
   * update immediately, and Cancel just drops it.
   */
  const [bgDraft, setBgDraft] = useState<BackgroundPlacement | null>(null);
  /** Whether the background positioning mode is active. */
  const [bgAdjust, setBgAdjust] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [history, setHistory] = useState<EditorUnit[][]>([]);
  const [future, setFuture] = useState<EditorUnit[][]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<LodgingCanvasHandle>(null);
  const didFitRef = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Push a snapshot of current units to the undo history (cap at 20). A new
  // action invalidates the redo stack.
  const pushHistory = useCallback((snapshot: EditorUnit[]) => {
    setHistory((prev) => [...prev, snapshot].slice(-20));
    setFuture([]);
  }, []);

  // Hydrate from the server ONCE (initial load). After that the local copy is
  // authoritative and is never auto-replaced — that re-hydration is exactly what
  // was resetting the map. A restored draft with unsaved edits wins over the
  // server copy.
  useEffect(() => {
    if (!map.data) return;
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;
    if (map.data.config) {
      setColorMode(map.data.config.colorMode);
      setGridSizeFt(map.data.config.gridSizeFt);
    }
    if (unitsRef.current.some((u) => u.dirty || u.isNew)) return; // keep restored draft
    setUnits(
      map.data.units.map((u) => ({
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
        dirty: false,
        isNew: false,
      })),
    );
  }, [map.data]);

  // Persist the working draft only while there are unsaved edits, so a remount or
  // reload restores it instead of snapping back to the server copy.
  useEffect(() => {
    try {
      if (units.some((u) => u.dirty || u.isNew)) {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(units));
      } else {
        window.sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      /* sessionStorage unavailable / quota — non-fatal */
    }
  }, [units]);

  // Measure the canvas container so the Stage (and its viewport-filling grid)
  // exactly fills it. The container only mounts once `map.data` has loaded (it's
  // gated behind it), so this MUST re-attach when data arrives or when toggling
  // full screen — otherwise the observer never binds and the canvas is stuck at
  // its 800×600 default, leaving the grid short of the right/bottom edges.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasSize({ width: Math.round(rect.width), height: Math.max(Math.round(rect.height), 480) });
      }
    };
    const ro = new ResizeObserver(() => {
      // Read the post-layout size on the next frame (coalesces resize bursts).
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(el);
    measure();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [map.data, fullscreen]);

  const updateUnit = useCallback((id: string, patch: Partial<EditorUnit>) => {
    setUnits((prev) => {
      pushHistory(prev);
      return prev.map((u) => (u.id === id ? { ...u, ...patch, dirty: true } : u));
    });
  }, [pushHistory]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setFuture((f) => [units, ...f].slice(0, 20));
    setUnits(last);
  }, [history, units]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setHistory((h) => [...h, units].slice(-20));
    setUnits(next);
  }, [future, units]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(units.map((u) => u.id)));
  }, [units]);

  // Duplicate every selected unit, offset slightly, and select the copies.
  const duplicateSelected = useCallback(() => {
    const sels = units.filter((u) => selectedIds.has(u.id));
    if (sels.length === 0) return;
    const copies = sels.map((u) => duplicateUnit(u, gridSizeFt, tempId()));
    setUnits((prev) => {
      pushHistory(prev);
      return [...prev, ...copies];
    });
    setSelectedIds(new Set(copies.map((c) => c.id)));
  }, [units, selectedIds, gridSizeFt, pushHistory]);

  // Copy/paste: ⌘C stashes the selection; ⌘V drops a fresh copy of it centred
  // on the current viewport, so you can pan + paste to lay out repeats quickly.
  const clipboardRef = useRef<EditorUnit[]>([]);
  const copySelected = useCallback(() => {
    const sels = units.filter((u) => selectedIds.has(u.id));
    if (sels.length) clipboardRef.current = sels.map((u) => ({ ...u }));
  }, [units, selectedIds]);
  const pasteClipboard = useCallback(() => {
    const buf = clipboardRef.current;
    if (!buf.length) return;
    const minX = Math.min(...buf.map((u) => u.x));
    const minY = Math.min(...buf.map((u) => u.y));
    const maxX = Math.max(...buf.map((u) => u.x + u.w));
    const maxY = Math.max(...buf.map((u) => u.y + u.h));
    const bcx = (minX + maxX) / 2;
    const bcy = (minY + maxY) / 2;
    const center = canvasRef.current?.viewportCenterFt() ?? { x: bcx + gridSizeFt * 2, y: bcy + gridSizeFt * 2 };
    const dx = snap(center.x - bcx, gridSizeFt);
    const dy = snap(center.y - bcy, gridSizeFt);
    const copies = buf.map((u) => ({ ...u, id: tempId(), x: u.x + dx, y: u.y + dy, dirty: true, isNew: true }));
    setUnits((prev) => {
      pushHistory(prev);
      return [...prev, ...copies];
    });
    setSelectedIds(new Set(copies.map((c) => c.id)));
  }, [gridSizeFt, pushHistory]);

  // Bring every selected unit to the front / back by reassigning z-order.
  const handleReorder = useCallback((dir: 'front' | 'back') => {
    if (selectedIds.size === 0 || units.length === 0) return;
    const orders = units.map((u) => u.sortOrder);
    const target = dir === 'front' ? Math.max(...orders) + 1 : Math.min(...orders) - 1;
    setUnits((prev) => {
      pushHistory(prev);
      return prev.map((u) => (selectedIds.has(u.id) ? { ...u, sortOrder: target, dirty: true } : u));
    });
  }, [selectedIds, units, pushHistory]);

  // Move every selected unit by (dxFt, dyFt) — used by arrow-key nudging.
  const nudgeSelected = useCallback((dxFt: number, dyFt: number) => {
    if (selectedIds.size === 0) return;
    setUnits((prev) => {
      pushHistory(prev);
      return prev.map((u) => (selectedIds.has(u.id) ? { ...u, x: u.x + dxFt, y: u.y + dyFt, dirty: true } : u));
    });
  }, [selectedIds, pushHistory]);

  // Align the selected units to a shared edge / centre.
  const alignSelected = useCallback((mode: 'left' | 'right' | 'hcenter' | 'top' | 'bottom' | 'vcenter') => {
    const sels = units.filter((u) => selectedIds.has(u.id));
    if (sels.length < 2) return;
    const minX = Math.min(...sels.map((u) => u.x));
    const maxX = Math.max(...sels.map((u) => u.x + u.w));
    const minY = Math.min(...sels.map((u) => u.y));
    const maxY = Math.max(...sels.map((u) => u.y + u.h));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setUnits((prev) => {
      pushHistory(prev);
      return prev.map((u) => {
        if (!selectedIds.has(u.id)) return u;
        let { x, y } = u;
        if (mode === 'left') x = minX;
        else if (mode === 'right') x = maxX - u.w;
        else if (mode === 'hcenter') x = cx - u.w / 2;
        else if (mode === 'top') y = minY;
        else if (mode === 'bottom') y = maxY - u.h;
        else if (mode === 'vcenter') y = cy - u.h / 2;
        return { ...u, x, y, dirty: true };
      });
    });
  }, [units, selectedIds, pushHistory]);

  // Commit a group drag (from the canvas): move many units at once, one history step.
  const handleGroupMove = useCallback((moves: Array<{ id: string; x: number; y: number }>) => {
    if (moves.length === 0) return;
    const byId = new Map(moves.map((m) => [m.id, m]));
    setUnits((prev) => {
      pushHistory(prev);
      return prev.map((u) => {
        const m = byId.get(u.id);
        return m ? { ...u, x: m.x, y: m.y, dirty: true } : u;
      });
    });
  }, [pushHistory]);

  // Delete every selected unit (server-delete the saved ones).
  const deleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = new Set(selectedIds);
    const toServerDelete = units.filter((u) => ids.has(u.id) && !u.isNew).map((u) => u.id);
    setSelectedIds(new Set());
    setUnits((prev) => prev.filter((u) => !ids.has(u.id)));
    for (const id of toServerDelete) {
      await deleteUnit.mutateAsync({ id });
    }
  }, [selectedIds, units, deleteUnit]);

  // Polished export: fit the whole plot, capture it, then compose a titled
  // header + kind legend + scale bar around it.
  const handleExportPng = useCallback(async (scope: MapExportScope) => {
    const data = map.data;
    const canvas = canvasRef.current;
    if (!data || !canvas) return;
    const cfg = data.config;
    const save = canvas.getViewState();
    const bg = canvas.getBackgroundBoundsFt();
    const site =
      cfg?.siteWidthFt && cfg?.siteDepthFt
        ? {
            widthFt: cfg.siteWidthFt,
            depthFt: cfg.siteDepthFt,
            streetTop: Boolean(cfg.streetTop),
            streetBottom: Boolean(cfg.streetBottom),
            streetRight: false,
          }
        : null;
    const crop = getMapExportBounds(scope, site, units, bg);
    if (crop) {
      canvas.fitToBounds(crop.minX, crop.minY, crop.maxX, crop.maxY, 4);
    }
    // Let the fit + viewport-filling grid render before capturing.
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    // 3x so unit labels survive at print size; crop so the tall camp does not
    // sit in a sea of empty viewport.
    const pixelRatio = 3;
    const mapUrl = canvas.exportPng(pixelRatio, crop ?? undefined);
    const pxPerFt = canvas.getPxPerFt() * pixelRatio;
    if (save) canvas.setViewState(save);
    if (!mapUrl) return;

    // Legend: only kinds actually on the map, with a silhouette hint so the
    // several near-identical cream fills stay tellable apart on paper.
    const SWATCH_SHAPE: Partial<Record<LodgingUnitKind, 'rect' | 'hexagon' | 'triangle' | 'trefoil' | 'round'>> = {
      SHIFTPOD: 'hexagon',
      SHADE_SAIL: 'triangle',
      MAHAL_TENT: 'trefoil',
      POWER_BOX: 'round',
    };
    const kinds = Array.from(new Set(units.map((u) => u.kind))).filter(
      (k) => !isPowerLayerKind(k) || layers.power,
    );
    const legend = kinds.map((k) => ({
      label: KIND_LABELS[k],
      color: KIND_COLORS[k],
      shape: SWATCH_SHAPE[k] ?? ('rect' as const),
    }));
    const addr = (cfg?.streetTop ?? '').replace(/\s*—.*$/, '').trim();
    const dimsStr = cfg?.siteWidthFt && cfg?.siteDepthFt ? `${cfg.siteWidthFt}×${cfg.siteDepthFt} ft` : '';
    const scopeLabel = scope === 'camp' ? 'Camp only' : 'Full map + neighbor context';
    const subtitle = [data.season?.name, scopeLabel, addr, dimsStr].filter(Boolean).join(' · ');

    let composed = mapUrl;
    try {
      composed = await composeMapExport(mapUrl, {
        title: scope === 'camp' ? `${campConfig.name} — Camp only` : `${campConfig.name} — Full map`,
        subtitle,
        legend,
        pxPerFt,
        frontageBearing: cfg?.frontageBearing ?? null,
      });
    } catch {
      /* fall back to the raw map image */
    }
    const a = document.createElement('a');
    const seasonName = data.season?.name?.replace(/\s+/g, '_') ?? 'lodging';
    a.href = composed;
    a.download = `${seasonName}_${scope === 'camp' ? 'camp-only' : 'full-map'}_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }, [layers.power, map.data, units]);

  const handleFitToContent = useCallback(() => {
    if (units.length === 0) return;
    const minX = Math.min(...units.map((u) => u.x));
    const minY = Math.min(...units.map((u) => u.y));
    const maxX = Math.max(...units.map((u) => u.x + u.w));
    const maxY = Math.max(...units.map((u) => u.y + u.h));
    canvasRef.current?.fitToBounds(minX, minY, maxX, maxY, 20);
  }, [units]);

  // Fit the plot into view once, on first load, so you start oriented.
  useEffect(() => {
    if (didFitRef.current) return;
    if (!map.data || units.length === 0 || canvasSize.width < 50) return;
    didFitRef.current = true;
    const sw = map.data.config?.siteWidthFt;
    const sd = map.data.config?.siteDepthFt;
    requestAnimationFrame(() => {
      if (sw && sd) canvasRef.current?.fitToBounds(0, 0, sw, sd, 25);
      else handleFitToContent();
    });
  }, [map.data, units.length, canvasSize.width, handleFitToContent]);

  const addUnit = useCallback((kind: LodgingUnitKind, overrides: Partial<EditorUnit> = {}) => {
    const defaults = KIND_DEFAULTS[kind];
    // Place new unit at the viewport center (centered on the unit's body).
    const center = canvasRef.current?.viewportCenterFt() ?? { x: 50, y: 50 };
    const w = overrides.w ?? defaults.w;
    const h = overrides.h ?? defaults.h;
    const newUnit: EditorUnit = {
      id: tempId(),
      kind,
      label: overrides.label ?? null,
      x: overrides.x ?? snap(center.x - w / 2, gridSizeFt),
      y: overrides.y ?? snap(center.y - h / 2, gridSizeFt),
      w,
      h,
      rotation: overrides.rotation ?? 0,
      color: overrides.color ?? null,
      partnerCamp: overrides.partnerCamp ?? null,
      notes: overrides.notes ?? null,
      sortOrder: overrides.sortOrder ?? 0,
      opacity: overrides.opacity ?? 1,
      dirty: true,
      isNew: true,
    };
    setUnits((prev) => {
      pushHistory(prev);
      return [...prev, newUnit];
    });
    setSelectedId(newUnit.id);
  }, [gridSizeFt, pushHistory]);

  // Handle drop of a member card from the unplaced tray onto the canvas.
  // Looks up the member, derives default dimensions from their housingType/Size,
  // creates a unit at the drop coordinates, and assigns the member in one go.
  const handleMemberDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const memberId = e.dataTransfer.getData('application/x-camp-member');
    if (!memberId || !map.data?.season) return;
    const member = map.data.unplacedMembers.find((m) => m.id === memberId);
    if (!member) return;
    const world = canvasRef.current?.screenToWorld(e.clientX, e.clientY);
    if (!world) return;
    const { kind, w, h } = defaultsForMember(member.housingType, member.housingSize);
    const x = snap(world.x - w / 2, gridSizeFt);
    const y = snap(world.y - h / 2, gridSizeFt);

    const created = await upsertUnit.mutateAsync({
      seasonId: map.data.season.id,
      unit: { kind, x, y, w, h, rotation: 0 },
    });
    await assignMember.mutateAsync({
      lodgingUnitId: created.id,
      seasonMemberId: memberId,
    });
    // Add the created unit to the local (authoritative) map directly — the map
    // query is no longer auto-hydrated, so a refetch won't surface it.
    setUnits((prev) => [
      ...prev,
      {
        id: created.id, kind: created.kind, label: created.label,
        x: created.x, y: created.y, w: created.w, h: created.h, rotation: created.rotation,
        color: created.color, partnerCamp: created.partnerCamp, notes: created.notes,
        sortOrder: created.sortOrder, opacity: created.opacity, dirty: false, isNew: false,
      },
    ]);
    utils.lodging.getMap.invalidate(); // refresh assignments + unplaced tray only
    setSelectedId(created.id);
  }, [map.data, gridSizeFt, upsertUnit, assignMember, utils]);

  const handleDelete = useCallback(async (id: string) => {
    const target = units.find((u) => u.id === id);
    if (!target) return;
    setSelectedId(null);
    if (target.isNew) {
      // never saved — just remove locally
      setUnits((prev) => prev.filter((u) => u.id !== id));
      return;
    }
    await deleteUnit.mutateAsync({ id });
    setUnits((prev) => prev.filter((u) => u.id !== id));
  }, [units, deleteUnit]);

  const handleSave = useCallback(async () => {
    const data = map.data;
    if (!data?.season?.id) return;
    const dirtyUnits = units.filter((u) => u.dirty);
    if (dirtyUnits.length === 0) return;

    const res = await saveUnits.mutateAsync({
      seasonId: data.season.id,
      units: dirtyUnits.map((u) => ({
        id: u.isNew ? undefined : u.id,
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
    });
    // Adopt server ids + clear dirty IN PLACE — no re-hydration. ids[i] aligns
    // with dirtyUnits[i]. Units re-edited during the save round-trip (different
    // object reference now) keep their dirty flag so the next save persists them.
    const idByOldId = new Map<string, string>();
    dirtyUnits.forEach((u, i) => {
      const real = res.ids?.[i];
      if (real) idByOldId.set(u.id, real);
    });
    const savedRefs = new Set<EditorUnit>(dirtyUnits);
    // Units the server could not find are gone from the database — deleted by an
    // importer or another session while this editor held them. Drop them rather
    // than leave ghosts that stay dirty forever and re-fail every save.
    const gone = new Set(res.skipped ?? []);
    setUnits((prev) =>
      prev
        .filter((u) => !gone.has(u.id))
        .map((u) => {
          const real = idByOldId.get(u.id);
          if (!real) return u;
          const unchanged = savedRefs.has(u);
          return { ...u, id: real, isNew: false, dirty: unchanged ? false : u.dirty };
        }),
    );
    setSkippedOnSave(gone.size);
  }, [map.data, units, saveUnits]);

  const handleColorModeChange = useCallback((mode: MapColorMode) => {
    setColorMode(mode);
    if (map.data?.season?.id) {
      upsertConfig.mutate({ seasonId: map.data.season.id, colorMode: mode });
    }
  }, [map.data, upsertConfig]);

  // ---- Background placement -------------------------------------------------
  // The saved placement from the server, and the effective one the canvas draws
  // (draft wins while positioning so drags and sliders show up instantly).
  const savedBgPlacement: BackgroundPlacement = {
    opacity: map.data?.config?.backgroundOpacity ?? 0.45,
    scale: map.data?.config?.backgroundScale ?? 1.0,
    x: map.data?.config?.backgroundX ?? 0,
    y: map.data?.config?.backgroundY ?? 0,
    rotation: map.data?.config?.backgroundRotation ?? 0,
  };
  const bgPlacement = bgDraft ?? savedBgPlacement;

  const patchBgDraft = useCallback(
    (patch: Partial<BackgroundPlacement>) => {
      setBgDraft((prev) => ({ ...(prev ?? savedBgPlacement), ...patch }));
    },
    // savedBgPlacement is derived from map.data; recreating on config change is
    // correct — a stale closure here would silently revert unsaved nudges.
    [map.data?.config],
  );

  const handleSaveBgPlacement = useCallback(() => {
    const seasonId = map.data?.season?.id;
    if (!seasonId || !bgDraft) return;
    upsertConfig.mutate(
      {
        seasonId,
        backgroundOpacity: bgDraft.opacity,
        backgroundScale: bgDraft.scale,
        backgroundX: bgDraft.x,
        backgroundY: bgDraft.y,
        backgroundRotation: bgDraft.rotation,
      },
      {
        // Clear the draft only once the refetched config carries the new values,
        // otherwise the canvas flashes back to the old placement in between.
        onSuccess: () => {
          utils.lodging.getMap.invalidate().then(() => setBgDraft(null));
        },
      },
    );
  }, [map.data, bgDraft, upsertConfig, utils]);

  const handleCancelBgPlacement = useCallback(() => {
    setBgDraft(null);
    setBgAdjust(false);
  }, []);

  // Overlay layers (compass, power). Persisted per-browser. The compass layer
  // replaced the separate Wind & Sun and mini-map layers; stored values of the
  // old keys migrate to it so nobody's toggle silently resets.
  // The power layer reads best in GRID_POWER tinting; remember what to restore.
  const prevColorModeRef = useRef<MapColorMode | null>(null);
  const handleToggleLayer = useCallback((layer: 'compass' | 'power') => {
    setLayers((prev) => {
      const next = { ...prev, [layer]: !prev[layer] };
      try { localStorage.setItem('lodging-layers', JSON.stringify(next)); } catch { /* private mode */ }
      if (layer === 'power') {
        if (next.power && colorMode !== 'GRID_POWER') {
          prevColorModeRef.current = colorMode;
          handleColorModeChange('GRID_POWER');
        } else if (!next.power && prevColorModeRef.current) {
          handleColorModeChange(prevColorModeRef.current);
          prevColorModeRef.current = null;
        }
      }
      return next;
    });
  }, [colorMode, handleColorModeChange]);

  // Turning the Power layer off hides plugs; don't leave one selected with its
  // properties panel open on a shape nobody can see.
  useEffect(() => {
    if (layers.power || selectedIds.size === 0) return;
    const visible = new Set(
      units.filter((u) => !isPowerLayerKind(u.kind)).map((u) => u.id),
    );
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [layers.power, selectedIds.size, units]);

  // Plugs drawn on the map are the CES order; member gridPower is the billing side.
  const plugs = useMemo(() => plugTally(units.map((u) => u.kind)), [units]);

  // Adding a plug turns the Power layer on — plugs only render there, so the
  // button would otherwise appear to do nothing.
  const handleAddPlug = useCallback((kind: LodgingUnitKind) => {
    if (!layers.power) handleToggleLayer('power');
    addUnit(kind);
  }, [layers.power, handleToggleLayer, addUnit]);

  const demand = useMemo(() => {
    const tiers = (map.data?.assignments ?? []).map(
      (a: { seasonMember: { gridPower: string } }) => a.seasonMember.gridPower as GridPowerTier,
    );
    return powerDemand(tiers);
  }, [map.data?.assignments]);

  // Keyboard: Delete = remove, Esc = deselect, Cmd/Ctrl+Z = undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === 'Escape') {
        if (fullscreen) setFullscreen(false);
        else setSelectedIds(new Set());
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      } else if (mod && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if (mod && e.key.toLowerCase() === 'c') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          copySelected();
        }
      } else if (mod && e.key.toLowerCase() === 'v') {
        if (clipboardRef.current.length) {
          e.preventDefault();
          pasteClipboard();
        }
      } else if (e.key.startsWith('Arrow') && selectedIds.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : gridSizeFt;
        if (e.key === 'ArrowUp') nudgeSelected(0, -step);
        else if (e.key === 'ArrowDown') nudgeSelected(0, step);
        else if (e.key === 'ArrowLeft') nudgeSelected(-step, 0);
        else if (e.key === 'ArrowRight') nudgeSelected(step, 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, deleteSelected, selectAll, handleUndo, handleRedo, duplicateSelected, copySelected, pasteClipboard, nudgeSelected, gridSizeFt, fullscreen]);

  // Occupant labels per unit (from assignments) — used as fallback display
  const occupantLabels = useMemo(() => {
    const out: Record<string, string> = {};
    if (!map.data) return out;
    for (const a of map.data.assignments) {
      const name = a.seasonMember.member.playaName ?? a.seasonMember.member.name;
      out[a.lodgingUnitId] = out[a.lodgingUnitId]
        ? `${out[a.lodgingUnitId]} + ${name}`
        : name;
    }
    return out;
  }, [map.data]);

  // Color overrides per unit based on color mode.
  const fillOverrides = useMemo(() => {
    const out: Record<string, string> = {};
    if (!map.data) return out;
    if (colorMode === 'GRID_POWER') {
      const memberPower = new Map<string, string>();
      for (const a of map.data.assignments) {
        memberPower.set(a.lodgingUnitId, a.seasonMember.gridPower);
      }
      for (const u of units) {
        const p = memberPower.get(u.id);
        if (!p) continue;
        if (p === 'AMP_50') out[u.id] = '#C2392E';
        else if (p === 'AMP_30') out[u.id] = '#D69540';
        else if (p === 'AMP_15') out[u.id] = '#DFC94A';
        else out[u.id] = '#8E8E8E';
      }
    } else if (colorMode === 'HOUSEHOLD') {
      const unitToHousehold = new Map<string, string>();
      for (const a of map.data.assignments) {
        if (a.household?.id && !unitToHousehold.has(a.lodgingUnitId)) {
          unitToHousehold.set(a.lodgingUnitId, a.household.id);
        }
      }
      for (const u of units) {
        const hid = unitToHousehold.get(u.id);
        if (hid) out[u.id] = hashHouseholdToColor(hid);
      }
    }
    return out;
  }, [map.data, units, colorMode]);

  // Paint order = sortOrder (Konva draws later children on top). Stable sort
  // keeps insertion order among equal sortOrder values.
  const orderedUnits = useMemo(() => [...units].sort((a, b) => a.sortOrder - b.sortOrder), [units]);

  const selected = units.find((u) => u.id === selectedId) ?? null;
  const selectedCanHaveOccupants = selected ? isAssignableLodgingKind(selected.kind) : false;
  const dirtyCount = units.filter((u) => u.dirty).length;

  const selectedOccupants = useMemo(() => {
    if (!selected || !map.data) return [];
    return map.data.assignments
      .filter((a) => a.lodgingUnitId === selected.id)
      .map((a) => ({
        id: a.seasonMember.id,
        name: a.seasonMember.member.name,
        playaName: a.seasonMember.member.playaName,
      }));
  }, [selected, map.data]);

  return (
    <div className="section-base">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-4">
          <div className="text-caption text-sage">Camp Layout</div>
          <h1 className="text-optical-h1 text-ink font-display flex items-center gap-2">
            <MapIcon className="w-7 h-7 text-gold" />
            Lodging
            {map.data?.season && (
              <span className="text-base text-ink/60 font-body">· {map.data.season.name}</span>
            )}
          </h1>
        </header>

        {map.isLoading && (
          <div className="flex items-center gap-2 text-ink/60">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading map…
          </div>
        )}

        {map.error && (
          <div className="luxury-card border-red-300 text-red-700 p-4">
            Failed to load map: {map.error.message}
          </div>
        )}

        {map.data && (
          <>
            {/* Editor surface — toolbar + canvas. In full screen this becomes a
                fixed viewport-filling overlay (z-50 so it sits over the admin
                sidebar/topbar); modals render after it so they stack above. */}
            <div className={fullscreen ? 'fixed inset-0 z-50 bg-[#FAF7F2] p-3 flex flex-col gap-3 overflow-hidden' : ''}>
            <LodgingToolbar
              dirtyCount={dirtyCount}
              saving={saveUnits.isPending}
              colorMode={colorMode}
              canUndo={history.length > 0}
              canRedo={future.length > 0}
              hasBackground={!!map.data.config?.backgroundUrl}
              bgAdjust={bgAdjust}
              onToggleBgAdjust={() => {
                // Leaving the mode discards an unsaved draft, same as Cancel.
                if (bgAdjust) handleCancelBgPlacement();
                else setBgAdjust(true);
              }}
              fullscreen={fullscreen}
              onToggleFullscreen={() => setFullscreen((f) => !f)}
              onAddKind={(k) => addUnit(k)}
              onAddPlug={handleAddPlug}
              onOpenAddModal={() => addUnit('STRUCTURE', { label: 'New' })}
              onOpenCsvImport={() => setCsvOpen(true)}
              onOpenSdrImport={() => setSdrOpen(true)}
              onOpenBackground={() => setBgOpen(true)}
              onOpenVersions={() => setVersionsOpen(true)}
              onExportPng={handleExportPng}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onFitToContent={handleFitToContent}
              onRotateView={(dir) => canvasRef.current?.rotateView(dir)}
              onColorModeChange={handleColorModeChange}
              layers={layers}
              onToggleLayer={handleToggleLayer}
              onSave={handleSave}
            />

            <div
              className={`grid gap-3 ${fullscreen ? 'flex-1 min-h-0' : ''}`}
              style={{
                gridTemplateColumns: selectedIds.size > 0 ? '1fr 320px' : '1fr',
                ...(fullscreen ? { gridTemplateRows: 'minmax(0, 1fr)' } : {}),
              }}
            >
              <div
                ref={containerRef}
                className="luxury-card overflow-hidden relative"
                style={fullscreen ? { minHeight: 0 } : { height: 'calc(100vh - 260px)', minHeight: 500 }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-camp-member')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }
                }}
                onDrop={handleMemberDrop}
              >
                <LodgingCanvas
                  ref={canvasRef}
                  units={orderedUnits}
                  selectedIds={selectedIds}
                  gridSizeFt={gridSizeFt}
                  occupantLabels={occupantLabels}
                  fillOverrides={fillOverrides}
                  background={
                    map.data.config?.backgroundUrl
                      ? { url: map.data.config.backgroundUrl, ...bgPlacement }
                      : null
                  }
                  backgroundEditable={bgAdjust && !!map.data.config?.backgroundUrl}
                  onBackgroundMove={(x, y) =>
                    patchBgDraft({
                      x: Math.round(x * 100) / 100,
                      y: Math.round(y * 100) / 100,
                    })
                  }
                  site={
                    map.data.config?.siteWidthFt && map.data.config?.siteDepthFt
                      ? {
                          widthFt: map.data.config.siteWidthFt,
                          depthFt: map.data.config.siteDepthFt,
                          // The top street spans the full neighbour composite, so do not
                          // draw a second camp-width ribbon.
                          streetTop: null,
                          streetBottom: map.data.config.streetBottom ?? null,
                          streetRight: null,
                        }
                      : null
                  }
                  width={canvasSize.width}
                  height={canvasSize.height}
                  onSelect={handleSelect}
                  onMarqueeSelect={(ids, additive) =>
                    setSelectedIds((prev) => (additive ? new Set([...prev, ...ids]) : new Set(ids)))
                  }
                  onGroupMove={handleGroupMove}
                  onChange={updateUnit}
                  powerHighlight={layers.power}
                  showPlugs={layers.power}
                />
                {layers.compass && (
                  <CampCompassOverlay bearing={map.data.config?.frontageBearing ?? null} />
                )}
                {layers.power && <PowerDemandCard demand={demand} plugs={plugs} />}
                {bgAdjust && map.data.config?.backgroundUrl && (
                  <BackgroundAdjustPanel
                    value={bgPlacement}
                    onChange={patchBgDraft}
                    onSave={handleSaveBgPlacement}
                    onCancel={handleCancelBgPlacement}
                    saving={upsertConfig.isPending}
                    dirty={bgDraft != null}
                  />
                )}
              </div>

              {selectedIds.size > 1 ? (
                <MultiSelectPanel
                  count={selectedIds.size}
                  onDuplicate={duplicateSelected}
                  onDelete={deleteSelected}
                  onAlign={alignSelected}
                  onReorder={handleReorder}
                  onClose={() => setSelectedIds(new Set())}
                />
              ) : selected ? (
                <UnitPropertiesPanel
                  unit={selected}
                  onChange={(patch) => updateUnit(selected.id, patch)}
                  onDelete={() => handleDelete(selected.id)}
                  onDuplicate={duplicateSelected}
                  onReorder={handleReorder}
                  onClose={() => setSelectedId(null)}
                  occupants={selectedOccupants}
                  assignmentSlot={
                    selected.isNew ? (
                      <div className="text-xs text-ink/50 italic">
                        Save the unit first, then assign members.
                      </div>
                    ) : !selectedCanHaveOccupants ? (
                      <div className="text-xs text-ink/50 italic">
                        This unit type does not take lodging occupants.
                      </div>
                    ) : map.data.season ? (
                      <AssignmentControl
                        seasonId={map.data.season.id}
                        lodgingUnitId={selected.id}
                        occupants={selectedOccupants}
                        onChanged={() => utils.lodging.getMap.invalidate()}
                      />
                    ) : (
                      null
                    )
                  }
                />
              ) : null}
            </div>
            </div>

            {map.data.season && (
              <>
                <CsvImportModal
                  seasonId={map.data.season.id}
                  open={csvOpen}
                  onClose={() => setCsvOpen(false)}
                  onImported={() => utils.lodging.getMap.invalidate()}
                />
                <SdrImportModal
                  seasonId={map.data.season.id}
                  open={sdrOpen}
                  onClose={() => setSdrOpen(false)}
                  onImported={() => utils.lodging.getMap.invalidate()}
                />
                <BackgroundImageModal
                  seasonId={map.data.season.id}
                  open={bgOpen}
                  initial={{
                    url: map.data.config?.backgroundUrl ?? null,
                    opacity: map.data.config?.backgroundOpacity ?? 0.45,
                    scale: map.data.config?.backgroundScale ?? 1.0,
                    x: map.data.config?.backgroundX ?? 0,
                    y: map.data.config?.backgroundY ?? 0,
                  }}
                  onClose={() => setBgOpen(false)}
                  onSaved={() => utils.lodging.getMap.invalidate()}
                />
                <VersionsModal
                  seasonId={map.data.season.id}
                  open={versionsOpen}
                  onClose={() => setVersionsOpen(false)}
                  onRestored={() => utils.lodging.getMap.invalidate()}
                />
              </>
            )}

            <div className="mt-3">
              <UnplacedMembersTray
                members={map.data.unplacedMembers}
                selectedUnitId={selected && !selected.isNew && selectedCanHaveOccupants ? selected.id : null}
                onAssigned={() => utils.lodging.getMap.invalidate()}
              />
            </div>

            <div className="mt-3 text-xs text-ink/50 flex flex-wrap gap-x-4 gap-y-1">
              <span>Drag / scroll: pan · Pinch or ⌘-scroll: zoom · Click: select · Shift/⌘-click or Shift-drag: multi-select · Drag selection: move group · Arrows: nudge · ⌘A: all · ⌘D: duplicate · ⌘C/⌘V: copy / paste (at viewport) · Del: remove</span>
              <span>{units.length} units · {map.data.unplacedMembers.length} unplaced confirmed members</span>
            </div>

            {saveUnits.error && (
              <div className="mt-3 text-sm text-red-700">Save failed: {saveUnits.error.message}</div>
            )}
            {skippedOnSave > 0 && (
              <div className="mt-3 text-sm text-amber-700">
                Saved, but {skippedOnSave} {skippedOnSave === 1 ? 'item was' : 'items were'} dropped:
                they no longer exist on the server, so they were removed from the map. Everything
                else was written.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
