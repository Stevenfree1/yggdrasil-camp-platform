import {
  buildMemberRows,
  buildBudgetRows,
  buildBuildRows,
  buildChargesRows,
  buildDgsRows,
  buildDuesRows,
  buildTabBalancesRows,
  dollars,
  prettyEnum,
  type MemberRowInput,
  type TabBalanceInput,
} from '@/server/lib/master-doc';

function memberRow(overrides: Partial<MemberRowInput> = {}): MemberRowInput {
  return {
    status: 'CONFIRMED',
    addedToWhatsApp: true,
    mapObject: 'A1',
    housingType: 'TENT',
    housingSize: '10x12',
    rideDetails: null,
    arrivalDate: new Date('2026-08-25T12:00:00Z'),
    departureDate: null,
    preApprovalForm: 'YES',
    buildCrew: true,
    strikeCrew: false,
    isCampVirgin: false,
    isBMVirgin: false,
    member: { name: 'Test Person', email: 'test@example.com', gender: 'MALE', dietaryRestrictions: null },
    payments: [],
    ...overrides,
  };
}

describe('prettyEnum', () => {
  it('title-cases underscore enums', () => {
    expect(prettyEnum('PURCHASED_CONFIRMED')).toBe('Purchased Confirmed');
    expect(prettyEnum('OPEN')).toBe('Open');
    expect(prettyEnum(null)).toBe('');
  });

  it('keeps acronyms uppercase', () => {
    expect(prettyEnum('DGS')).toBe('DGS');
    expect(prettyEnum('DGS_DIRECT')).toBe('DGS Direct');
    expect(prettyEnum('GREY_WATER')).toBe('Grey Water');
  });
});

describe('dollars', () => {
  it('converts cents to dollars', () => {
    expect(dollars(120000)).toBe(1200);
    expect(dollars(12345)).toBe(123.45);
    expect(dollars(0)).toBe(0);
  });
});

describe('buildMemberRows', () => {
  it('returns header-only for empty input', () => {
    const rows = buildMemberRows([]);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('Confirmed');
    expect(rows[0]).toHaveLength(22);
  });

  it('maps enums to the historical labels', () => {
    const rows = buildMemberRows([
      memberRow({ payments: [{ type: 'DUES' }] }),
    ]);
    const row = rows[1];
    expect(row[0]).toBe('Y'); // CONFIRMED
    expect(row[2]).toBe('Test Person');
    expect(row[4]).toBe('Y'); // dues paid
    expect(row[6]).toBe('Tent');
    expect(row[15]).toBe('M');
    expect(row[17]).toBe('Y'); // build crew
    expect(row[18]).toBe(''); // strike crew
  });

  it('leaves dues blank when no DUES payment exists', () => {
    const rows = buildMemberRows([
      memberRow({ payments: [{ type: 'GRID' }] }),
    ]);
    expect(rows[1][4]).toBe('');
  });
});

describe('buildDuesRows', () => {
  it('sorts payments by date and converts amounts to dollars', () => {
    const rows = buildDuesRows([
      {
        memberName: 'B', type: 'GRID', paidAt: new Date('2026-06-02T12:00:00Z'),
        amount: 5000, method: 'ZELLE', notes: null, paidTo: null,
      },
      {
        memberName: 'A', type: 'DUES', paidAt: new Date('2026-06-01T12:00:00Z'),
        amount: 120000, method: 'PAYPAL', notes: 'first half', paidTo: 'Jamie',
      },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(['', 'Dues', 'A', 'Jun 1', 1200, 'Paypal', 'first half', 'Jamie']);
    expect(rows[2][1]).toBe('Grid');
    expect(rows[2][4]).toBe(50);
  });
});

describe('buildTabBalancesRows', () => {
  const base: Omit<TabBalanceInput, 'duesStatus' | 'duesOverrideCents'> = {
    status: 'CONFIRMED',
    member: { name: 'Test', email: 't@example.com' },
    payments: [],
    charges: [],
  };

  it('uses season dues when there is no override', () => {
    const rows = buildTabBalancesRows(
      [{ ...base, duesStatus: 'UNPAID', duesOverrideCents: null, payments: [{ type: 'DUES', amount: 40000 }] }],
      120000,
    );
    // expected / paid / remaining / open / total
    expect(rows[1].slice(4)).toEqual([1200, 400, 800, 0, 800]);
  });

  it('respects a dues override', () => {
    const rows = buildTabBalancesRows(
      [{ ...base, duesStatus: 'UNPAID', duesOverrideCents: 60000 }],
      120000,
    );
    expect(rows[1].slice(4)).toEqual([600, 0, 600, 0, 600]);
  });

  it('treats WAIVED dues as zero expected', () => {
    const rows = buildTabBalancesRows(
      [{ ...base, duesStatus: 'WAIVED', duesOverrideCents: null }],
      120000,
    );
    expect(rows[1].slice(4)).toEqual([0, 0, 0, 0, 0]);
  });

  it('counts only OPEN charges toward the balance', () => {
    const rows = buildTabBalancesRows(
      [{
        ...base,
        duesStatus: 'PAID',
        duesOverrideCents: null,
        payments: [{ type: 'DUES', amount: 120000 }],
        charges: [
          { amountCents: 5000, status: 'OPEN' },
          { amountCents: 7000, status: 'PAID' },
          { amountCents: 9000, status: 'VOID' },
        ],
      }],
      120000,
    );
    expect(rows[1].slice(7)).toEqual([50, 50]); // open charges, total owed
  });

  it('ignores non-DUES payments when summing dues paid', () => {
    const rows = buildTabBalancesRows(
      [{ ...base, duesStatus: 'UNPAID', duesOverrideCents: null, payments: [{ type: 'GRID', amount: 40000 }] }],
      120000,
    );
    expect(rows[1].slice(4)).toEqual([1200, 0, 1200, 0, 1200]);
  });
});

describe('buildChargesRows', () => {
  it('renders charge lines with pretty statuses and dollar amounts', () => {
    const rows = buildChargesRows([
      {
        memberName: 'Test', label: 'Tent Power', amountCents: 7500,
        status: 'OPEN', source: 'SELF', createdAt: new Date('2026-06-01T00:00:00Z'),
        paidAt: null, voidedAt: null, note: null,
      },
    ]);
    expect(rows[1].slice(0, 5)).toEqual(['Test', 'Tent Power', 75, 'Open', 'Self']);
  });
});

describe('buildDgsRows', () => {
  it('falls back to placeholder name/email when there is no member', () => {
    const rows = buildDgsRows([
      {
        type: 'DGS', quantity: 2, status: 'PURCHASED_CONFIRMED', source: 'DGS_DIRECT',
        vehiclePass: true, purchaseConfirmed: true, purchasedAt: null, notes: null,
        placeholderName: 'Ghost Rider', placeholderEmail: 'ghost@example.com', member: null,
      },
    ]);
    const row = rows[1];
    expect(row[0]).toBe('Ghost Rider');
    expect(row[1]).toBe('ghost@example.com');
    expect(row[3]).toBe(2);
    expect(row[4]).toBe('Purchased Confirmed');
    expect(row[5]).toBe('Y');
  });

  it('prefers the linked member over placeholders', () => {
    const rows = buildDgsRows([
      {
        type: 'DGS', quantity: 1, status: 'INVITED', source: 'DGS_DIRECT',
        vehiclePass: false, purchaseConfirmed: false, purchasedAt: null, notes: null,
        placeholderName: 'Stale Name', placeholderEmail: null,
        member: { name: 'Real Member', email: 'real@example.com' },
      },
    ]);
    expect(rows[1][0]).toBe('Real Member');
    expect(rows[1][1]).toBe('real@example.com');
  });
});

describe('buildBuildRows', () => {
  it('flattens one row per assignment across build days', () => {
    const rows = buildBuildRows([
      {
        name: 'Tuesday Build',
        date: new Date('2026-08-18T12:00:00Z'),
        assignments: [
          { wapTicketId: 'WAP-1', team: 'shade', notes: null, seasonMember: { member: { name: 'A', email: 'a@x.com' } } },
          { wapTicketId: null, team: null, notes: null, seasonMember: { member: { name: 'B', email: 'b@x.com' } } },
        ],
      },
      { name: 'Friday Build', date: new Date('2026-08-21T12:00:00Z'), assignments: [] },
    ]);
    expect(rows).toHaveLength(3); // header + 2 assignments (empty day adds nothing)
    expect(rows[1][0]).toBe('Tuesday Build');
    expect(rows[1][4]).toBe('WAP-1');
  });
});

describe('buildBudgetRows', () => {
  it('leaves actual blank when not recorded and converts amounts', () => {
    const rows = buildBudgetRows([
      { category: 'GREY_WATER', description: null, estimatedAmount: 250000, actualAmount: null, notes: null },
      { category: 'FUEL', description: 'generator', estimatedAmount: 100000, actualAmount: 87550, notes: null },
    ]);
    expect(rows[1][0]).toBe('Grey Water');
    expect(rows[1][2]).toBe(2500);
    expect(rows[1][3]).toBe('');
    expect(rows[2][3]).toBe(875.5);
  });
});
