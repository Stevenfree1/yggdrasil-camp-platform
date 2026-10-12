'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Map as MapIcon, MapPin } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { EditorUnit } from './types';
import { LodgingCanvas, type LodgingCanvasHandle } from './LodgingCanvas';

export function PortalLodgingView() {
  const my = trpc.lodging.getMyUnit.useQuery({});
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<LodgingCanvasHandle>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: Math.max(rect.height, 400) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [my.data]);

  const allUnits: EditorUnit[] = (my.data?.allUnits ?? []).map((u) => ({
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
  }));

  useEffect(() => {
    if (!my.data?.unit || canvasSize.width <= 0 || canvasSize.height <= 0) return;
    const unit = my.data.unit;
    const frame = requestAnimationFrame(() => {
      canvasRef.current?.fitToBounds(unit.x, unit.y, unit.x + unit.w, unit.y + unit.h, 35);
    });
    return () => cancelAnimationFrame(frame);
  }, [my.data?.unit, canvasSize.width, canvasSize.height]);

  const occupantLabels = (my.data?.assignments ?? []).reduce<Record<string, string>>((out, assignment) => {
    const name = assignment.seasonMember.member.playaName ?? assignment.seasonMember.member.name;
    out[assignment.lodgingUnitId] = out[assignment.lodgingUnitId]
      ? `${out[assignment.lodgingUnitId]} + ${name}`
      : name;
    return out;
  }, {});

  return (
    <div className="section-base">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-4">
          <div className="text-caption text-sage">Your Placement</div>
          <h1 className="text-optical-h1 text-ink font-display flex items-center gap-2">
            <MapIcon className="w-7 h-7 text-gold" />
            Camp Lodging
          </h1>
        </header>

        {my.isLoading && (
          <div className="flex items-center gap-2" style={{ color: 'var(--color-ink-soft)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading map…
          </div>
        )}

        {my.data && !my.data.unit && (
          <div className="luxury-card p-6" style={{ color: 'var(--color-ink-soft)' }}>
            Your lodging spot isn't placed yet. The camp lead will assign you on the map closer
            to the burn. Check back later, or ping a lead in WhatsApp if you have a question.
          </div>
        )}

        {my.data?.unit && (
          <>
            <div className="luxury-card p-4 mb-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <div className="text-caption text-sage inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Your unit
                </div>
                <div className="font-display text-xl text-ink">
                  {my.data.unit.label ?? my.data.unit.kind}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
                  {my.data.unit.kind} · {my.data.unit.w}×{my.data.unit.h} ft
                </div>
              </div>

              {my.data.occupants.length > 1 && (
                <div className="mt-2 text-sm" style={{ color: 'var(--color-ink-soft)' }}>
                  <span className="text-caption text-sage">Co-occupants: </span>
                  {my.data.occupants
                    .filter((o) => o.id)
                    .map((o) => (o.playaName ? `${o.playaName} (${o.name})` : o.name))
                    .join(', ')}
                </div>
              )}
            </div>

            <div
              ref={containerRef}
              className="luxury-card overflow-hidden"
              style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}
            >
              <LodgingCanvas
                ref={canvasRef}
                units={allUnits}
                gridSizeFt={my.data.config?.gridSizeFt ?? 1}
                occupantLabels={occupantLabels}
                fillOverrides={{}}
                background={
                  my.data.config?.backgroundUrl
                    ? {
                        url: my.data.config.backgroundUrl,
                        opacity: my.data.config.backgroundOpacity,
                        scale: my.data.config.backgroundScale,
                        x: my.data.config.backgroundX,
                        y: my.data.config.backgroundY,
                      }
                    : null
                }
                width={canvasSize.width}
                height={canvasSize.height}
                onSelect={() => {}}
                onChange={() => {}}
                readOnly
                highlightId={my.data.unit.id}
              />
            </div>

            <div className="mt-2 text-xs" style={{ color: 'var(--color-ink-faint)' }}>
              Your spot is highlighted in gold. Other units are dimmed for context.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
