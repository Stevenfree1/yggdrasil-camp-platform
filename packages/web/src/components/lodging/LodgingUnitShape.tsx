'use client';

import { useEffect, useRef, useState } from 'react';
import { Group, Rect, Text, Transformer, Line, Circle, Path } from 'react-konva';
import type Konva from 'konva';
import { EditorUnit, KIND_COLORS, PX_PER_FT, SELECTED_STROKE, snap } from './types';
import { ITEM_CATALOG, footprintPoints } from './catalog';
import { renderSkin, polygonClip } from './skins';

interface Props {
  unit: EditorUnit;
  isSelected: boolean;
  selectionSize?: number;
  gridSizeFt: number;
  occupantLabel?: string;
  fillOverride?: string;
  readOnly?: boolean;
  registerNode?: (id: string, node: Konva.Group | null) => void;
  onSelect: (id: string, additive: boolean) => void;
  onGroupDragStart?: (id: string) => void;
  onGroupDragMove?: (id: string) => void;
  onGroupDragEnd?: (id: string) => void;
  onChange: (id: string, patch: Partial<EditorUnit>) => void;
}

/**
 * Renders one LodgingUnit as a Konva Group with kind-specific decoration:
 *   RV / TRAILER : rounded body + wheel marks + hitch
 *   TENT         : ridge + panel seams + door flap (top-down ridge tent)
 *   SHIFTPOD     : octagonal body + radial seams + vent hub (geodesic dome)
 *   DORM         : rect with interior partition lines
 *   STRUCTURE    : cross-hatched fill
 *   BOUNDARY     : thick dashed line, transparent body
 *   STREET_LABEL : text only, no body
 *   POWER_BOX    : small body + lightning bolt icon
 *
 * On drag/resize/rotate end, position and dimensions snap to the grid
 * and changes are reported via onChange.
 */
export function LodgingUnitShape({
  unit,
  isSelected,
  selectionSize = 1,
  gridSizeFt,
  occupantLabel,
  fillOverride,
  readOnly = false,
  registerNode,
  onSelect,
  onGroupDragStart,
  onGroupDragMove,
  onGroupDragEnd,
  onChange,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  // True while the unit is being dragged or resized. The dimension badge is
  // rendered outside the unit's group (see below) so it can't move with a live
  // drag; hiding it beats leaving it stranded at the old position.
  const [interacting, setInteracting] = useState(false);

  // Group drag when this unit is one of several selected. The transformer
  // (resize/rotate handles) only attaches to a lone selection.
  const isGroupDrag = isSelected && selectionSize > 1;
  const showTransformer = isSelected && selectionSize === 1 && !readOnly;

  useEffect(() => {
    if (showTransformer && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [showTransformer]);

  const fill = fillOverride ?? unit.color ?? KIND_COLORS[unit.kind];
  const wPx = unit.w * PX_PER_FT;
  const hPx = unit.h * PX_PER_FT;
  const displayLabel = unit.label ?? occupantLabel ?? null;

  // Trailers with several occupants read as room compartments: the body is
  // partitioned along its long axis, one occupant name per room. Both editors
  // join occupant names with " + " (LodgingEditor / PortalLodgingView), so the
  // shape splits on the same token. A manual unit.label opts out.
  const trailerRooms =
    unit.kind === 'TRAILER' && !unit.label && occupantLabel && occupantLabel.includes(' + ')
      ? occupantLabel.split(' + ')
      : null;

  // Re-measure whenever the footprint changes.
  //
  // A Transformer caches the node's client rect and only drops that cache when
  // the node fires a transform event or one of its `_attrsAffectingSize`
  // changes. `Group` inherits an *empty* `_attrsAffectingSize`, so setting
  // width/height on it invalidates nothing, and a Group's client rect is
  // computed from its children anyway. Resizing therefore left a stale box:
  // handleTransformEnd resets scale (which does invalidate) while the children
  // are still at their old size, React then re-renders them at the new size,
  // and nothing tells the Transformer to look again — so the handles kept
  // showing the pre-resize footprint.
  useEffect(() => {
    if (showTransformer) transformerRef.current?.forceUpdate();
  }, [showTransformer, wPx, hPx, unit.rotation, unit.kind]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setInteracting(false);
    const node = e.target;
    const newX = snap(node.x() / PX_PER_FT, gridSizeFt);
    const newY = snap(node.y() / PX_PER_FT, gridSizeFt);
    node.position({ x: newX * PX_PER_FT, y: newY * PX_PER_FT });
    onChange(unit.id, { x: newX, y: newY });
  };

  const handleTransformEnd = () => {
    setInteracting(false);
    const node = groupRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const newW = Math.max(1, snap(unit.w * scaleX, gridSizeFt));
    const newH = Math.max(1, snap(unit.h * scaleY, gridSizeFt));
    const newX = snap(node.x() / PX_PER_FT, gridSizeFt);
    const newY = snap(node.y() / PX_PER_FT, gridSizeFt);
    const newRotation = node.rotation();
    node.scaleX(1);
    node.scaleY(1);
    node.width(newW * PX_PER_FT);
    node.height(newH * PX_PER_FT);
    node.position({ x: newX * PX_PER_FT, y: newY * PX_PER_FT });
    onChange(unit.id, { w: newW, h: newH, x: newX, y: newY, rotation: newRotation });
  };

  const footprint = ITEM_CATALOG[unit.kind].footprint;
  const skinId = ITEM_CATALOG[unit.kind].skin;
  const isLabel = footprint.type === 'none';
  const isBoundary = footprint.type === 'line';
  const isPower = unit.kind === 'POWER_BOX';
  const stroke = isSelected ? SELECTED_STROKE : isBoundary ? '#2C2416' : '#2C2416A0';
  const strokeWidth = isSelected ? 2.5 : isBoundary ? 2.5 : 1;

  // Realistic top-down skin (supersedes the legacy decoration for its kind).
  // Drawn over the body, which stays underneath as the hit/selection surface.
  // Polygon footprints clip the skin so hatch patterns don't spill the outline.
  const renderSkinLayer = () => {
    if (!skinId) return null;
    const clipPoints = footprint.type === 'polygon' ? footprintPoints(unit.kind, wPx, hPx) : null;
    return (
      <Group
        listening={false}
        opacity={unit.opacity}
        clipFunc={clipPoints ? polygonClip(clipPoints) : undefined}
      >
        {/* Per-unit colour override wins; otherwise the kind's own catalog colour
            (so a 15A plug is orange, a 30A blue, a 50A salmon, L21-30 pale). */}
        {renderSkin(
          skinId,
          wPx,
          hPx,
          unit.color ?? ITEM_CATALOG[unit.kind].color,
          ITEM_CATALOG[unit.kind].plugRating,
        )}
      </Group>
    );
  };

  // Kind-specific decoration (rendered after base body, before label)
  const renderDecoration = () => {
    switch (unit.kind) {
      case 'RV':
      case 'TRAILER': {
        // RV: rounded body with wheel circles at bottom corners + small hitch on long side
        const wheelR = Math.min(wPx, hPx) * 0.08;
        const wheelInset = wheelR * 1.6;
        const isHorizontal = wPx > hPx;
        return (
          <>
            {/* wheels along long edge */}
            {isHorizontal ? (
              <>
                <Circle x={wheelInset} y={hPx - wheelInset * 0.3} radius={wheelR} fill="#2C2416" listening={false} />
                <Circle x={wPx - wheelInset} y={hPx - wheelInset * 0.3} radius={wheelR} fill="#2C2416" listening={false} />
                <Circle x={wPx * 0.5} y={hPx - wheelInset * 0.3} radius={wheelR * 0.85} fill="#2C2416" listening={false} />
              </>
            ) : (
              <>
                <Circle x={wPx - wheelInset * 0.3} y={wheelInset} radius={wheelR} fill="#2C2416" listening={false} />
                <Circle x={wPx - wheelInset * 0.3} y={hPx - wheelInset} radius={wheelR} fill="#2C2416" listening={false} />
                <Circle x={wPx - wheelInset * 0.3} y={hPx * 0.5} radius={wheelR * 0.85} fill="#2C2416" listening={false} />
              </>
            )}
            {/* hitch indicator at one short end (only for TRAILER) */}
            {unit.kind === 'TRAILER' && (
              <Line
                points={
                  isHorizontal
                    ? [0, hPx * 0.5, -wheelR, hPx * 0.5]
                    : [wPx * 0.5, 0, wPx * 0.5, -wheelR]
                }
                stroke="#2C2416"
                strokeWidth={1.5}
                listening={false}
              />
            )}
            {/* door indicator (light line on side) */}
            <Rect
              x={isHorizontal ? wPx * 0.55 : 2}
              y={isHorizontal ? 2 : hPx * 0.55}
              width={isHorizontal ? wPx * 0.12 : 3}
              height={isHorizontal ? 3 : hPx * 0.12}
              fill="#2C241680"
              listening={false}
            />
            {/* room compartments — one per occupant, split along the long axis */}
            {trailerRooms &&
              trailerRooms.map((_, i) => {
                const n = trailerRooms.length;
                const pos = i / n;
                return (
                  <Group key={`room-${i}`} listening={false}>
                    {i % 2 === 1 && (
                      <Rect
                        x={isHorizontal ? wPx * pos : 1}
                        y={isHorizontal ? 1 : hPx * pos}
                        width={isHorizontal ? wPx / n : wPx - 2}
                        height={isHorizontal ? hPx - 2 : hPx / n}
                        fill="#2C2416"
                        opacity={0.06}
                      />
                    )}
                    {i > 0 && (
                      <Line
                        points={
                          isHorizontal
                            ? [wPx * pos, 2, wPx * pos, hPx - 2]
                            : [2, hPx * pos, wPx - 2, hPx * pos]
                        }
                        stroke="#2C2416"
                        strokeWidth={1.2}
                        opacity={0.5}
                      />
                    )}
                  </Group>
                );
              })}
          </>
        );
      }
      case 'TENT': {
        // Top-down ridge tent: a centre ridge with panel seams sloping to the
        // corners, plus a small door flap on the front (bottom) edge.
        const isWide = wPx >= hPx;
        const cx = wPx / 2;
        const cy = hPx / 2;
        const m = Math.min(wPx, hPx) * 0.12; // ridge inset from the short ends
        const s = '#2C2416';
        const ridge = isWide ? [m, cy, wPx - m, cy] : [cx, m, cx, hPx - m];
        const seams: number[][] = isWide
          ? [
              [m, cy, 0, 0], [m, cy, 0, hPx],
              [wPx - m, cy, wPx, 0], [wPx - m, cy, wPx, hPx],
            ]
          : [
              [cx, m, 0, 0], [cx, m, wPx, 0],
              [cx, hPx - m, 0, hPx], [cx, hPx - m, wPx, hPx],
            ];
        const dw = Math.min(wPx * 0.3, 24);
        const dh = Math.min(hPx * 0.22, 16);
        return (
          <>
            {seams.map((p, i) => (
              <Line key={`ts-${i}`} points={p} stroke={s} strokeWidth={0.9} opacity={0.35} listening={false} />
            ))}
            <Line points={ridge} stroke={s} strokeWidth={1.3} opacity={0.6} listening={false} />
            <Line
              points={[cx - dw / 2, hPx, cx, hPx - dh, cx + dw / 2, hPx]}
              stroke={s}
              strokeWidth={1}
              opacity={0.55}
              listening={false}
            />
          </>
        );
      }
      case 'SHIFTPOD': {
        // Geodesic dome read: radial seams from each octagon vertex to a
        // central vent hub, with an inner concentric ring (dome tier).
        const pts = footprintPoints('SHIFTPOD', wPx, hPx) ?? [];
        const cx = wPx / 2;
        const cy = hPx / 2;
        const s = '#2C2416';
        const inner: number[] = [];
        const spokes: JSX.Element[] = [];
        for (let i = 0; i < pts.length; i += 2) {
          spokes.push(
            <Line key={`sp-${i}`} points={[pts[i], pts[i + 1], cx, cy]} stroke={s} strokeWidth={0.7} opacity={0.3} listening={false} />,
          );
          inner.push(cx + (pts[i] - cx) * 0.5, cy + (pts[i + 1] - cy) * 0.5);
        }
        const ventR = Math.min(wPx, hPx) * 0.08;
        return (
          <>
            {spokes}
            <Line points={inner} closed stroke={s} strokeWidth={0.8} opacity={0.4} listening={false} />
            <Circle x={cx} y={cy} radius={ventR} fill={s} opacity={0.5} listening={false} />
          </>
        );
      }
      case 'DORM': {
        // 3 evenly-spaced vertical partitions
        return (
          <>
            <Line points={[wPx / 3, 4, wPx / 3, hPx - 4]} stroke="#2C241680" strokeWidth={1} listening={false} />
            <Line points={[(2 * wPx) / 3, 4, (2 * wPx) / 3, hPx - 4]} stroke="#2C241680" strokeWidth={1} listening={false} />
          </>
        );
      }
      case 'STRUCTURE': {
        // Soft inset border — quieter than the old cross-hatch, which read
        // as "under construction" once real skins landed around it.
        return (
          <Rect
            x={2.5}
            y={2.5}
            width={Math.max(wPx - 5, 1)}
            height={Math.max(hPx - 5, 1)}
            cornerRadius={2}
            stroke="#2C241626"
            strokeWidth={1}
            listening={false}
          />
        );
      }
      case 'POWER_BOX': {
        // Lightning bolt icon centered
        const cx = wPx / 2;
        const cy = hPx / 2;
        const s = Math.min(wPx, hPx) * 0.4;
        return (
          <Path
            data={`M ${cx + s * 0.1} ${cy - s} L ${cx - s * 0.4} ${cy + s * 0.1} L ${cx - s * 0.05} ${cy + s * 0.1} L ${cx - s * 0.3} ${cy + s} L ${cx + s * 0.4} ${cy - s * 0.1} L ${cx + s * 0.05} ${cy - s * 0.1} Z`}
            fill="#2C2416"
            listening={false}
          />
        );
      }
      default:
        return null;
    }
  };

  // Body: drawn from the catalog footprint. Polygon kinds (ShiftPod octagon,
  // shade-sail triangle) use a closed Line; BOUNDARY is a dashed transparent
  // perimeter; label-only kinds have no body; everything else is a Rect.
  // Selected: gold glow. Unselected physical bodies: a whisper of drop shadow
  // for depth. Labels and boundaries stay flat.
  const selectionShadow = isSelected
    ? { shadowColor: '#D4AF37', shadowBlur: 12, shadowOpacity: 0.4 }
    : isLabel || isBoundary
      ? { shadowColor: 'transparent', shadowBlur: 0, shadowOpacity: 0 }
      : {
          shadowColor: '#2C2416',
          shadowBlur: 3,
          shadowOpacity: 0.18,
          shadowOffsetX: 1,
          shadowOffsetY: 1.5,
        };
  const renderBody = () => {
    switch (footprint.type) {
      case 'none':
        return null;
      case 'line':
        return (
          <Rect
            width={wPx}
            height={hPx}
            fill="transparent"
            stroke={isSelected ? SELECTED_STROKE : '#2C2416'}
            strokeWidth={2.5}
            dash={footprint.dashed ? [10, 5] : undefined}
          />
        );
      case 'polygon':
        return (
          <Line
            points={footprintPoints(unit.kind, wPx, hPx) ?? []}
            closed
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={unit.opacity}
            {...selectionShadow}
          />
        );
      case 'rect':
      default:
        return (
          <Rect
            width={wPx}
            height={hPx}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            cornerRadius={
              unit.kind === 'RV' || unit.kind === 'TRAILER' ? Math.min(wPx, hPx) * 0.1 :
              isPower ? Math.min(wPx, hPx) * 0.15 :
              footprint.type === 'rect' ? footprint.cornerRadius ?? 3 :
              3
            }
            opacity={unit.opacity}
            {...selectionShadow}
          />
        );
    }
  };

  return (
    <>
      <Group
        ref={(node) => {
          groupRef.current = node;
          registerNode?.(unit.id, node);
        }}
        x={unit.x * PX_PER_FT}
        y={unit.y * PX_PER_FT}
        width={wPx}
        height={hPx}
        rotation={unit.rotation}
        draggable={!readOnly}
        onClick={(e) => onSelect(unit.id, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey)}
        onTap={() => onSelect(unit.id, false)}
        onDragStart={() => {
          setInteracting(true);
          if (!isSelected) onSelect(unit.id, false);
          if (isGroupDrag) onGroupDragStart?.(unit.id);
        }}
        onDragMove={isGroupDrag ? () => onGroupDragMove?.(unit.id) : undefined}
        onDragEnd={
          isGroupDrag
            ? () => {
                setInteracting(false);
                onGroupDragEnd?.(unit.id);
              }
            : handleDragEnd
        }
        onTransformStart={() => setInteracting(true)}
        onTransformEnd={handleTransformEnd}
      >
        {renderBody()}
        {skinId ? renderSkinLayer() : renderDecoration()}
        {/* Status-tint ring: colorMode tint stays visible over a skin as a
            border instead of a fill, so the skin artwork remains readable. */}
        {skinId && fillOverride && (
          footprint.type === 'polygon' ? (
            <Line
              points={footprintPoints(unit.kind, wPx, hPx) ?? []}
              closed
              stroke={fillOverride}
              strokeWidth={3}
              listening={false}
            />
          ) : (
            <Rect width={wPx} height={hPx} stroke={fillOverride} strokeWidth={3} listening={false} />
          )
        )}
        {trailerRooms ? (
          // One name per room compartment, centered in its slice.
          trailerRooms.map((name, i) => {
            const n = trailerRooms.length;
            const horizontal = wPx > hPx;
            const rw = horizontal ? wPx / n : wPx;
            const rh = horizontal ? hPx : hPx / n;
            return (
              <Text
                key={`room-name-${i}`}
                x={(horizontal ? rw * i : 0) + 2}
                y={(horizontal ? 0 : rh * i) + 2}
                width={Math.max(rw - 4, 8)}
                height={Math.max(rh - 4, 8)}
                text={name}
                fontSize={Math.min(12, Math.max(7, Math.min(rw, rh) / 4.5))}
                fontFamily="Inter, sans-serif"
                fill="#2C2416"
                align="center"
                verticalAlign="middle"
                listening={false}
                shadowColor="#FAF7F2"
                shadowBlur={3}
                shadowOpacity={0.9}
              />
            );
          })
        ) : displayLabel && (
          <Text
            x={4}
            y={isLabel ? 0 : 4}
            width={Math.max(wPx - 8, 10)}
            height={Math.max(hPx - 8, 10)}
            text={displayLabel}
            fontSize={Math.min(13, Math.max(8, Math.min(wPx, hPx) / 5.5))}
            fontStyle={isLabel || unit.kind === 'CONTAINER' ? 'bold' : 'normal'}
            fontFamily="Inter, sans-serif"
            fill={
              // Names and labels are always ink — white-on-skin was unreadable
              // Containers keep their real-world blue stencil.
              // A cream halo keeps ink legible on the few dark grounds
              // (charcoal canopy fabric, dark per-unit colors).
              unit.kind === 'CONTAINER' ? '#2B6CB0' : '#2C2416'
            }
            align={isLabel || isPower ? 'center' : 'left'}
            verticalAlign={isLabel || isPower ? 'middle' : 'top'}
            listening={false}
            shadowColor={isLabel ? 'transparent' : '#FAF7F2'}
            shadowBlur={isLabel ? 0 : 3}
            shadowOpacity={0.9}
          />
        )}
      </Group>
      {/* Dimension badge on the selected unit.
          Deliberately a sibling of the unit's group, not a child. The
          Transformer sizes itself from the group's getClientRect, which unions
          every child — a badge drawn below the footprint pushed the handles a
          badge-height clear of the shape (most obvious on the flat, wide kinds
          like bike parking and shade). Outside the group it can't distort the
          bounds. It mirrors the group's transform so it tracks rotation. */}
      {isSelected && !isLabel && !interacting && (
        <Group
          x={unit.x * PX_PER_FT}
          y={unit.y * PX_PER_FT}
          rotation={unit.rotation}
          listening={false}
        >
          <Text
            x={0}
            y={hPx + 4}
            width={wPx}
            text={`${unit.w}×${unit.h}ft`}
            fontSize={10}
            fontFamily="Inter, sans-serif"
            fill="#D4AF37"
            align="center"
            listening={false}
          />
        </Group>
      )}
      {showTransformer && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          enabledAnchors={[
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right',
          ]}
          boundBoxFunc={(_oldBox, newBox) => {
            if (newBox.width < PX_PER_FT || newBox.height < PX_PER_FT) {
              return _oldBox;
            }
            return newBox;
          }}
          anchorFill="#D4AF37"
          anchorStroke="#2C2416"
          borderStroke="#D4AF37"
          borderDash={[4, 4]}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        />
      )}
    </>
  );
}
