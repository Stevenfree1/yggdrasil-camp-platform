'use client';

import { M, UI_FONT, DISPLAY_FONT } from './medallion';
import type { PowerDemand, PlugTally } from '../power-demand';

/**
 * The power readout for the Power layer.
 *
 * Two different numbers, deliberately shown side by side:
 *
 *  - **Plugs placed** is the order. It is what CES gets asked for and what the
 *    electrician wires, counted off the plugs drawn on the map.
 *  - **Member requests** is the billing side, from what people picked on their
 *    profile.
 *
 * They are allowed to differ — a plug can feed a shared structure, and a member
 * can pay before anyone has placed their plug — but a large gap is worth a look
 * before the order goes in, so the card calls it out rather than hiding it.
 */
export function PowerDemandCard({ demand, plugs }: { demand: PowerDemand; plugs: PlugTally }) {
  const rows = [
    { label: '15A', placed: plugs.count15, asked: demand.count15 },
    { label: '30A', placed: plugs.count30, asked: demand.count30 },
    { label: '50A', placed: plugs.count50, asked: demand.count50 },
  ];
  const totalPlugs = plugs.count15 + plugs.count30 + plugs.count50 + plugs.countL2130;
  const totalAsked = demand.count15 + demand.count30 + demand.count50;
  const gap = totalAsked - (plugs.count15 + plugs.count30 + plugs.count50);

  return (
    <div
      className="!absolute bottom-3 right-3 !z-10 pointer-events-none select-none rounded-sm px-3.5 py-2.5"
      style={{
        background: M.parchment,
        border: `1px solid ${M.gold}`,
        boxShadow: '0 6px 16px rgba(44, 36, 22, 0.22)',
        fontFamily: UI_FONT,
        minWidth: 208,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: M.sage,
          fontWeight: 600,
          borderBottom: `1px solid ${M.tan}`,
          paddingBottom: 4,
          marginBottom: 6,
        }}
      >
        Power order · plugs placed
      </div>

      <div className="flex items-end justify-between gap-3">
        {rows.map((r) => (
          <div key={r.label} className="text-center">
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 20,
                lineHeight: 1,
                color: M.ink,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {r.placed}
            </div>
            <div style={{ fontSize: 8.5, letterSpacing: '0.1em', color: M.ink, opacity: 0.55, marginTop: 2 }}>
              {r.label}
            </div>
            <div style={{ fontSize: 8, color: M.ink, opacity: 0.4, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
              ask {r.asked}
            </div>
          </div>
        ))}
        {plugs.countL2130 > 0 && (
          <div className="text-center">
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 20,
                lineHeight: 1,
                color: M.ink,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {plugs.countL2130}
            </div>
            <div style={{ fontSize: 8.5, letterSpacing: '0.1em', color: M.ink, opacity: 0.55, marginTop: 2 }}>
              L21-30
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 7,
          paddingTop: 5,
          borderTop: `1px solid ${M.tan}`,
          fontSize: 10,
          color: M.ink,
          opacity: 0.75,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {totalPlugs} plugs · ≈ {plugs.totalKw} kW connected
      </div>

      {totalPlugs === 0 ? (
        <div style={{ marginTop: 4, fontSize: 9.5, color: M.sage }}>
          Add plugs from the toolbar to build the order.
        </div>
      ) : gap !== 0 ? (
        <div style={{ marginTop: 4, fontSize: 9.5, color: M.sienna }}>
          {gap > 0
            ? `${gap} member request${gap === 1 ? '' : 's'} without a plug`
            : `${-gap} plug${gap === -1 ? '' : 's'} beyond member requests`}
        </div>
      ) : null}
    </div>
  );
}
