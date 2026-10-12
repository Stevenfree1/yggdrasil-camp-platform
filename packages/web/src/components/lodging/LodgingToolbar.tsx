'use client';

import { Plus, Save, Loader2, Tent, Truck, Box, Type, Square, Triangle, Zap, Layers, Upload, FileUp, Download, Undo2, Redo2, ImagePlus, History, Maximize2, RotateCw, RotateCcw, Expand, Shrink, Container, UtensilsCrossed, Landmark, Umbrella, Plug, Move, Bike } from 'lucide-react';
import { LodgingUnitKind, MapColorMode, KIND_LABELS } from './types';
import type { MapExportScope } from '../../lib/lodging-export';

interface Props {
  dirtyCount: number;
  saving: boolean;
  colorMode: MapColorMode;
  canUndo: boolean;
  canRedo: boolean;
  hasBackground: boolean;
  /** Whether background positioning mode is active. */
  bgAdjust: boolean;
  onToggleBgAdjust: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onAddKind: (kind: LodgingUnitKind) => void;
  /** Adds a plug and switches the Power layer on, since plugs only render there. */
  onAddPlug: (kind: LodgingUnitKind) => void;
  onOpenAddModal: () => void;
  onOpenCsvImport: () => void;
  onOpenSdrImport: () => void;
  onOpenBackground: () => void;
  onOpenVersions: () => void;
  onExportPng: (scope: MapExportScope) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitToContent: () => void;
  onRotateView: (dir: 'cw' | 'ccw') => void;
  onColorModeChange: (mode: MapColorMode) => void;
  layers: { compass: boolean; power: boolean };
  onToggleLayer: (layer: 'compass' | 'power') => void;
  onSave: () => void;
}

const KIND_ICONS: Partial<Record<LodgingUnitKind, React.ComponentType<{ className?: string }>>> = {
  TENT: Tent,
  RV: Truck,
  SHIFTPOD: Box,
  TRAILER: Truck,
  DORM: Box,
  STRUCTURE: Square,
  SHADE_SAIL: Triangle,
  BOUNDARY: Square,
  STREET_LABEL: Type,
  TEXT_LABEL: Type,
  POWER_BOX: Zap,
  CONTAINER: Container,
  DINING_TENT: UtensilsCrossed,
  BOX_TRUCK: Truck,
  MAHAL_TENT: Landmark,
  CANOPY: Umbrella,
  SHADE_CLOTH: Layers,
  BIKE_PARKING: Bike,
  PLUG_15A: Plug,
  PLUG_30A: Plug,
  PLUG_50A: Plug,
  PLUG_L21_30: Plug,
};

/** Plug kinds live behind the Power layer — they are the power company's view. */
const PLUG_KINDS: LodgingUnitKind[] = ['PLUG_15A', 'PLUG_30A', 'PLUG_50A', 'PLUG_L21_30'];

const QUICK_KINDS: LodgingUnitKind[] = [
  'TENT', 'RV', 'SHIFTPOD', 'STRUCTURE', 'SHADE_SAIL', 'SHADE_CLOTH', 'CANOPY',
  'CONTAINER', 'DINING_TENT', 'BOX_TRUCK', 'MAHAL_TENT', 'BIKE_PARKING',
  'WATER_TANK', 'POD', 'HITCH',
  'STREET_LABEL', 'POWER_BOX',
];

export function LodgingToolbar({
  dirtyCount,
  saving,
  colorMode,
  canUndo,
  canRedo,
  hasBackground,
  bgAdjust,
  onToggleBgAdjust,
  fullscreen,
  onToggleFullscreen,
  onAddKind,
  onAddPlug,
  onOpenAddModal,
  onOpenCsvImport,
  onOpenSdrImport,
  onOpenBackground,
  onOpenVersions,
  onExportPng,
  onUndo,
  onRedo,
  onFitToContent,
  onRotateView,
  onColorModeChange,
  layers,
  onToggleLayer,
  onSave,
}: Props) {
  return (
    <div className="luxury-card flex flex-wrap items-center gap-2 p-3 mb-3">
      <span className="text-caption text-sage pr-1">Add</span>
      {QUICK_KINDS.map((kind) => {
        const Icon = KIND_ICONS[kind] ?? Plus;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onAddKind(kind)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded hover:bg-cream/60 text-ink"
            title={`Add ${KIND_LABELS[kind]}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {KIND_LABELS[kind]}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenAddModal}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded hover:bg-cream/60 text-ink"
        title="Add custom unit"
      >
        <Plus className="w-3.5 h-3.5" />
        Custom…
      </button>

      {/* Plugs sit in the Add group because that is what they are — objects you
          place. They previously lived at the tail of the bar at text-xs, which
          made them unfindable. Same size and contrast as every other Add
          button; the gold tint only marks that the Power layer is showing. */}
      <span className="text-caption text-sage pl-2 inline-flex items-center gap-1">
        <Plug className="w-3.5 h-3.5" />
        Plugs
      </span>
      {PLUG_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          onClick={() => onAddPlug(kind)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded border transition-colors text-ink ${
            layers.power
              ? 'border-gold/60 bg-gold/10 hover:bg-gold/20'
              : 'border-warm-border hover:bg-cream/60'
          }`}
          title={
            layers.power
              ? `Add ${KIND_LABELS[kind]}`
              : `Add ${KIND_LABELS[kind]} — turns the Power layer on, since plugs only show there`
          }
        >
          <Plug className="w-3.5 h-3.5" />
          {KIND_LABELS[kind].replace(' Plug', '').replace(' (stage)', '')}
        </button>
      ))}

      <button
        type="button"
        onClick={onOpenCsvImport}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded hover:bg-cream/60 text-ink"
        title="Import units from CSV"
      >
        <Upload className="w-3.5 h-3.5" />
        CSV
      </button>

      <button
        type="button"
        onClick={onOpenSdrImport}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded hover:bg-cream/60 text-ink"
        title="Import a SmartDraw .sdr map (background + recovered labels)"
      >
        <FileUp className="w-3.5 h-3.5" />
        SmartDraw
      </button>

      <button
        type="button"
        onClick={onOpenBackground}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border rounded hover:bg-cream/60 text-ink ${
          hasBackground ? 'border-gold/70 bg-gold/5' : 'border-warm-border'
        }`}
        title="Upload reference background image (e.g. prior-year layout)"
      >
        <ImagePlus className="w-3.5 h-3.5" />
        Background{hasBackground ? ' ✓' : ''}
      </button>

      {/* Only meaningful once an image exists — hidden rather than disabled so
          the toolbar stays short for the common case. */}
      {hasBackground && (
        <button
          type="button"
          onClick={onToggleBgAdjust}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border rounded hover:bg-cream/60 text-ink ${
            bgAdjust ? 'border-gold/70 bg-gold/10' : 'border-warm-border'
          }`}
          title="Drag and scale the reference image against the camp layout"
          aria-pressed={bgAdjust}
        >
          <Move className="w-3.5 h-3.5" />
          Position BG
        </button>
      )}

      <button
        type="button"
        onClick={onOpenVersions}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-warm-border rounded hover:bg-cream/60 text-ink"
        title="Save or restore map versions"
      >
        <History className="w-3.5 h-3.5" />
        Versions
      </button>

      <div className="h-6 w-px bg-warm-border mx-2" />

      <span className="text-caption text-sage pr-1 inline-flex items-center gap-1">
        <Layers className="w-3.5 h-3.5" />
        Color by
      </span>
      <div className="inline-flex rounded border border-warm-border overflow-hidden">
        <button
          type="button"
          onClick={() => onColorModeChange('HOUSEHOLD')}
          className={`px-2.5 py-1.5 text-sm ${colorMode === 'HOUSEHOLD' ? 'bg-sage text-cream' : 'bg-transparent text-ink hover:bg-cream/60'}`}
        >
          Household
        </button>
        <button
          type="button"
          onClick={() => onColorModeChange('GRID_POWER')}
          className={`px-2.5 py-1.5 text-sm border-l border-warm-border ${colorMode === 'GRID_POWER' ? 'bg-sage text-cream' : 'bg-transparent text-ink hover:bg-cream/60'}`}
        >
          Grid Power
        </button>
      </div>

      <span className="text-caption text-sage pl-2 inline-flex items-center gap-1">Layers</span>
      {([
        ['compass', 'Compass'],
        ['power', 'Power'],
      ] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onToggleLayer(id)}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
            layers[id]
              ? 'bg-gold/20 border-gold text-ink font-medium'
              : 'border-warm-border text-ink/60 hover:bg-cream/60'
          }`}
          title={`Toggle ${label} layer`}
          aria-pressed={layers[id]}
        >
          {label}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={`inline-flex items-center gap-1 px-2 py-1.5 text-sm hover:text-ink ${fullscreen ? 'text-gold' : 'text-ink/70'}`}
          title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen — fill the window'}
          aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}
        >
          {fullscreen ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={onFitToContent}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-ink/70 hover:text-ink"
          title="Zoom to fit all units"
          aria-label="Fit canvas to all placed units"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onRotateView('ccw')}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-ink/70 hover:text-ink"
          title="Rotate view 90° counter-clockwise (view only — does not move units)"
          aria-label="Rotate view 90 degrees counter-clockwise"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onRotateView('cw')}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-ink/70 hover:text-ink"
          title="Rotate view 90° clockwise (view only — does not move units)"
          aria-label="Rotate view 90 degrees clockwise"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-ink/70 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Cmd+Z)"
          aria-label="Undo last change"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-ink/70 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Cmd+Shift+Z)"
          aria-label="Redo last undone change"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
        <div className="inline-flex overflow-hidden rounded border border-warm-border" role="group" aria-label="Download map">
          <button
            type="button"
            onClick={() => onExportPng('camp')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-ink hover:bg-cream/60"
            title="Download the camp site only, without the neighbor reference map"
            aria-label="Download camp-only map as PNG"
          >
            <Download className="w-3.5 h-3.5" />
            Camp only
          </button>
          <button
            type="button"
            onClick={() => onExportPng('full')}
            className="inline-flex items-center gap-1.5 border-l border-warm-border px-2.5 py-1.5 text-sm text-ink hover:bg-cream/60"
            title="Download the camp with the full neighbor and placement context"
            aria-label="Download full map as PNG"
          >
            Full map
          </button>
        </div>
        {dirtyCount > 0 && (
          <span className="text-xs text-gold pl-2">{dirtyCount} unsaved</span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || dirtyCount === 0}
          className="cta-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>
    </div>
  );
}
