import { isDuesUnpaid } from '../../server/lib/recipients';

describe('recipients — isDuesUnpaid (corrected segment rule)', () => {
  const base = { seasonDuesCents: 120000, duesOverrideCents: null as number | null };

  it('UNPAID with nothing paid is unpaid', () => {
    expect(isDuesUnpaid({ ...base, duesStatus: 'UNPAID', duesPaidCents: 0 })).toBe(true);
  });

  it('UNPAID with partial payment is still unpaid', () => {
    expect(isDuesUnpaid({ ...base, duesStatus: 'UNPAID', duesPaidCents: 50000 })).toBe(true);
  });

  it('UNPAID but paid in full is NOT unpaid', () => {
    expect(isDuesUnpaid({ ...base, duesStatus: 'UNPAID', duesPaidCents: 120000 })).toBe(false);
  });

  it('honors a custom override: paying the reduced amount clears it', () => {
    expect(
      isDuesUnpaid({ seasonDuesCents: 120000, duesOverrideCents: 60000, duesStatus: 'UNPAID', duesPaidCents: 60000 }),
    ).toBe(false);
  });

  it('honors a custom override: short of the reduced amount is unpaid', () => {
    expect(
      isDuesUnpaid({ seasonDuesCents: 120000, duesOverrideCents: 60000, duesStatus: 'UNPAID', duesPaidCents: 30000 }),
    ).toBe(true);
  });

  it('WAIVED is never unpaid, even with no payments', () => {
    expect(isDuesUnpaid({ ...base, duesStatus: 'WAIVED', duesPaidCents: 0 })).toBe(false);
  });

  it('PAID status wins even if recorded payments fall short', () => {
    expect(isDuesUnpaid({ ...base, duesStatus: 'PAID', duesPaidCents: 0 })).toBe(false);
  });
});
