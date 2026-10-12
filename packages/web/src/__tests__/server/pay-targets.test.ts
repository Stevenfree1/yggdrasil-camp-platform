import { formatPayTarget, parsePayTarget } from '../../server/lib/pay-targets';

describe('pay-targets codec', () => {
  it('round-trips a dues target', () => {
    const cid = formatPayTarget({ kind: 'dues', seasonMemberId: 'sm-1' });
    expect(cid).toBe('dues:sm-1');
    expect(parsePayTarget(cid)).toEqual({ kind: 'dues', seasonMemberId: 'sm-1' });
  });

  it('round-trips a charge target', () => {
    const cid = formatPayTarget({ kind: 'charge', chargeId: 'ch-9' });
    expect(cid).toBe('charge:ch-9');
    expect(parsePayTarget(cid)).toEqual({ kind: 'charge', chargeId: 'ch-9' });
  });

  it('treats a bare uuid as a legacy dues target', () => {
    expect(parsePayTarget('a1b2c3d4-0000-4000-8000-000000000000')).toEqual({
      kind: 'dues',
      seasonMemberId: 'a1b2c3d4-0000-4000-8000-000000000000',
    });
  });

  it('returns null for empty/garbage', () => {
    expect(parsePayTarget('')).toBeNull();
    expect(parsePayTarget(undefined)).toBeNull();
    expect(parsePayTarget('bogus:thing')).toBeNull();
  });
});
