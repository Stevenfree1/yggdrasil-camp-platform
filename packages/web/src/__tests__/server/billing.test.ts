import {
  effectiveDuesCents,
  duesRemainingCents,
  openChargesTotalCents,
  tabBalanceCents,
  resolveDuesPaymentCents,
} from '../../server/lib/billing';

describe('billing — dues', () => {
  it('uses the season amount when there is no override', () => {
    expect(effectiveDuesCents('UNPAID', null, 120000)).toBe(120000);
  });

  it('uses the override when set', () => {
    expect(effectiveDuesCents('UNPAID', 60000, 120000)).toBe(60000);
  });

  it('is zero when WAIVED, regardless of override/amount', () => {
    expect(effectiveDuesCents('WAIVED', 60000, 120000)).toBe(0);
    expect(effectiveDuesCents('WAIVED', null, 120000)).toBe(0);
  });

  it('remaining subtracts payments and never goes negative', () => {
    expect(duesRemainingCents({ duesStatus: 'UNPAID', duesOverrideCents: null, seasonDuesCents: 120000, duesPaidCents: 50000 })).toBe(70000);
    expect(duesRemainingCents({ duesStatus: 'UNPAID', duesOverrideCents: null, seasonDuesCents: 120000, duesPaidCents: 130000 })).toBe(0);
  });

  it('remaining is zero for a WAIVED member even with no payments', () => {
    expect(duesRemainingCents({ duesStatus: 'WAIVED', duesOverrideCents: null, seasonDuesCents: 120000, duesPaidCents: 0 })).toBe(0);
  });
});

describe('billing — charges & balance', () => {
  it('sums only OPEN charges', () => {
    const charges = [
      { amountCents: 5000, status: 'OPEN' as const },
      { amountCents: 2500, status: 'PAID' as const },
      { amountCents: 9999, status: 'VOID' as const },
      { amountCents: 5000, status: 'OPEN' as const },
    ];
    expect(openChargesTotalCents(charges)).toBe(10000);
  });

  it('balance = dues remaining + open charges', () => {
    expect(tabBalanceCents({ duesRemainingCents: 70000, openChargesTotalCents: 10000 })).toBe(80000);
  });
});

describe('billing — resolveDuesPaymentCents', () => {
  it('defaults to the full remaining when amount is undefined', () => {
    expect(resolveDuesPaymentCents(undefined, 70000)).toBe(70000);
  });
  it('allows an over-payment above the remaining (members may pay extra)', () => {
    expect(resolveDuesPaymentCents(999999, 70000)).toBe(999999);
  });
  it('keeps a valid partial amount', () => {
    expect(resolveDuesPaymentCents(20000, 70000)).toBe(20000);
  });
  it('throws on zero/negative', () => {
    expect(() => resolveDuesPaymentCents(0, 70000)).toThrow();
    expect(() => resolveDuesPaymentCents(-5, 70000)).toThrow();
  });
  it('throws when nothing is owed, even with an explicit amount', () => {
    expect(() => resolveDuesPaymentCents(undefined, 0)).toThrow();
    expect(() => resolveDuesPaymentCents(5000, 0)).toThrow();
  });
});
