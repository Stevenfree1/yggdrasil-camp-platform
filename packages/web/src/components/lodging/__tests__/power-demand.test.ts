import { powerDemand, plugTally } from '../power-demand';

describe('powerDemand', () => {
  it('returns zeros for empty input', () => {
    expect(powerDemand([])).toEqual({ count15: 0, count30: 0, count50: 0, totalAmps: 0, totalKw: 0 });
  });

  it('counts tiers and sums amps and kW', () => {
    const d = powerDemand(['AMP_15', 'AMP_30', 'AMP_30', 'AMP_50', 'NONE']);
    expect(d.count15).toBe(1);
    expect(d.count30).toBe(2);
    expect(d.count50).toBe(1);
    expect(d.totalAmps).toBe(15 + 30 + 30 + 50);
    expect(d.totalKw).toBeCloseTo(1.8 + 3.6 + 3.6 + 12);
  });

  it('ignores NONE for counts but not for totals math', () => {
    const d = powerDemand(['NONE', 'NONE']);
    expect(d.totalAmps).toBe(0);
    expect(d.totalKw).toBe(0);
  });
});

describe('plugTally', () => {
  it('counts plugs by rating and sums estimated kW', () => {
    const t = plugTally(['PLUG_15A', 'PLUG_15A', 'PLUG_30A', 'PLUG_50A', 'PLUG_L21_30']);
    expect(t.count15).toBe(2);
    expect(t.count30).toBe(1);
    expect(t.count50).toBe(1);
    expect(t.countL2130).toBe(1);
    expect(t.totalKw).toBeCloseTo(1.8 * 2 + 3.6 + 12 + 10.8);
  });

  it('ignores non-plug kinds', () => {
    const t = plugTally(['TENT', 'RV', 'CONTAINER', 'POWER_BOX']);
    expect(t).toEqual({ count15: 0, count30: 0, count50: 0, countL2130: 0, totalKw: 0 });
  });

  it('returns zeros for empty input', () => {
    expect(plugTally([]).totalKw).toBe(0);
  });
});
