/**
 * Grid-power demand math for the power layer. Pure — jest-covered.
 * kW estimates per service tier: 15A/120V ≈ 1.8, 30A/120V ≈ 3.6,
 * 50A/240V ≈ 12 (standard RV service ratings).
 */

export type GridPowerTier = 'NONE' | 'AMP_15' | 'AMP_30' | 'AMP_50';

export interface PowerDemand {
  count15: number;
  count30: number;
  count50: number;
  totalAmps: number;
  totalKw: number;
}

const KW: Record<GridPowerTier, number> = { NONE: 0, AMP_15: 1.8, AMP_30: 3.6, AMP_50: 12 };
const AMPS: Record<GridPowerTier, number> = { NONE: 0, AMP_15: 15, AMP_30: 30, AMP_50: 50 };

export function powerDemand(tiers: GridPowerTier[]): PowerDemand {
  const d: PowerDemand = { count15: 0, count30: 0, count50: 0, totalAmps: 0, totalKw: 0 };
  for (const t of tiers) {
    if (t === 'AMP_15') d.count15++;
    else if (t === 'AMP_30') d.count30++;
    else if (t === 'AMP_50') d.count50++;
    d.totalAmps += AMPS[t] ?? 0;
    d.totalKw += KW[t] ?? 0;
  }
  d.totalKw = Math.round(d.totalKw * 10) / 10;
  return d;
}

/** What the CES order is actually sized from: plugs placed on the map. */
export interface PlugTally {
  count15: number;
  count30: number;
  count50: number;
  countL2130: number;
  totalKw: number;
}

const PLUG_KW: Record<string, number> = {
  PLUG_15A: 1.8,
  PLUG_30A: 3.6,
  PLUG_50A: 12,
  PLUG_L21_30: 10.8,
};

/**
 * Tally power plugs placed on the map. This is the order sheet — the member
 * `gridPower` field is the billing side and the two are allowed to differ
 * (a plug can serve a shared structure; a member can pay before placement).
 */
export function plugTally(kinds: string[]): PlugTally {
  const t: PlugTally = { count15: 0, count30: 0, count50: 0, countL2130: 0, totalKw: 0 };
  for (const k of kinds) {
    if (k === 'PLUG_15A') t.count15++;
    else if (k === 'PLUG_30A') t.count30++;
    else if (k === 'PLUG_50A') t.count50++;
    else if (k === 'PLUG_L21_30') t.countL2130++;
    else continue;
    t.totalKw += PLUG_KW[k] ?? 0;
  }
  t.totalKw = Math.round(t.totalKw * 10) / 10;
  return t;
}
