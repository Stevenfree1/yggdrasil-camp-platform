/**
 * Behaviour that must hold for shift signup, exercised through the real router
 * with a fake prisma. The claim race and the signup gate are the two places a
 * regression would be silently harmful, so they get the most attention.
 */
import { TRPCError } from '@trpc/server';

jest.mock('superjson', () => ({
  __esModule: true,
  default: {
    serialize: (v: unknown) => ({ json: v }),
    deserialize: (v: { json: unknown }) => v.json,
  },
}));
jest.mock('../../server/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), security: jest.fn() },
}));

import { shiftsRouter } from '../../server/routers/shifts';

const SEASON = { id: 's1', year: 2026, shiftSignupOpen: true, minShiftsPerMember: 2 };
const ME = { id: 'sm1' };

/**
 * `claimCount` controls what the conditional update reports: 1 = this caller
 * won the race, 0 = someone else got there first.
 */
function makePrisma(opts: {
  signupOpen?: boolean;
  instance?: Record<string, unknown> | null;
  seasonMember?: { id: string } | null;
  claimCount?: number;
  sameDay?: unknown[];
}) {
  const season = { ...SEASON, shiftSignupOpen: opts.signupOpen ?? true };
  const instance =
    opts.instance === undefined
      ? {
          id: 'i1',
          date: new Date('2026-08-30T12:00:00.000Z'),
          seasonMemberId: null,
          slot: { label: 'Ice-1', block: { name: 'Ice Run', startTime: '09:00', endTime: '11:00', season } },
        }
      : opts.instance;

  return {
    season: {
      findFirst: jest.fn().mockResolvedValue({ id: season.id }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(season),
      update: jest.fn().mockResolvedValue(season),
    },
    seasonMember: {
      findFirst: jest.fn().mockResolvedValue(
        opts.seasonMember === undefined ? ME : opts.seasonMember,
      ),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    shiftInstance: {
      findUnique: jest.fn().mockResolvedValue(instance),
      findMany: jest.fn().mockResolvedValue(opts.sameDay ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: opts.claimCount ?? 1 }),
      update: jest.fn().mockResolvedValue({ id: 'i1' }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
}

function caller(prisma: unknown) {
  return shiftsRouter.createCaller({
    user: { id: 'm1', email: 'a@example.com', name: 'A', role: 'MEMBER', adminScopes: [] },
    prisma,
    cookieStore: {} as never,
  } as never);
}

describe('claim', () => {
  it('claims an open cell', async () => {
    const prisma = makePrisma({});
    await expect(caller(prisma).claim({ instanceId: '11111111-1111-4111-8111-111111111111' }))
      .resolves.toEqual({ success: true });
    // The guard on the update is what makes it race-safe.
    expect(prisma.shiftInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ seasonMemberId: null }) }),
    );
  });

  it('tells the loser when someone else claimed it first', async () => {
    const prisma = makePrisma({ claimCount: 0 });
    await expect(
      caller(prisma).claim({ instanceId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('just took') });
  });

  it('refuses while signup is closed', async () => {
    const prisma = makePrisma({ signupOpen: false });
    await expect(
      caller(prisma).claim({ instanceId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.shiftInstance.updateMany).not.toHaveBeenCalled();
  });

  it('refuses when the member is not enrolled in the season', async () => {
    const prisma = makePrisma({ seasonMember: null });
    await expect(
      caller(prisma).claim({ instanceId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses a shift overlapping one they already hold that day', async () => {
    const prisma = makePrisma({
      sameDay: [
        {
          id: 'other',
          slot: { block: { name: 'Kitchen', startTime: '10:00', endTime: '12:00' } },
        },
      ],
    });
    await expect(
      caller(prisma).claim({ instanceId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('Kitchen') });
  });

  it('allows a non-overlapping shift on the same day', async () => {
    const prisma = makePrisma({
      sameDay: [
        {
          id: 'other',
          slot: { block: { name: 'Dinner', startTime: '16:00', endTime: '18:00' } },
        },
      ],
    });
    await expect(
      caller(prisma).claim({ instanceId: '11111111-1111-4111-8111-111111111111' }),
    ).resolves.toEqual({ success: true });
  });
});

describe('release', () => {
  const held = {
    id: 'i1',
    date: new Date('2026-08-30T12:00:00.000Z'),
    seasonMemberId: 'sm1',
    slot: {
      label: 'Ice-1',
      block: { name: 'Ice Run', startTime: '09:00', endTime: '11:00', season: SEASON },
    },
  };

  it('releases your own cell', async () => {
    const prisma = makePrisma({ instance: held });
    await expect(caller(prisma).release({ instanceId: '11111111-1111-4111-8111-111111111111' }))
      .resolves.toEqual({ success: true });
  });

  it('refuses to release someone else’s cell', async () => {
    const prisma = makePrisma({ instance: { ...held, seasonMemberId: 'someone-else' } });
    await expect(
      caller(prisma).release({ instanceId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(prisma.shiftInstance.update).not.toHaveBeenCalled();
  });

  it('refuses while signup is closed', async () => {
    const prisma = makePrisma({
      instance: {
        ...held,
        slot: { ...held.slot, block: { ...held.slot.block, season: { ...SEASON, shiftSignupOpen: false } } },
      },
    });
    await expect(
      caller(prisma).release({ instanceId: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('myGrid', () => {
  it('reports the gate and the minimum without leaking the grid when closed', async () => {
    const prisma = makePrisma({ signupOpen: false });
    (prisma as unknown as { shiftBlock: unknown }).shiftBlock = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    const res = await caller(prisma).myGrid({});
    expect(res.signupOpen).toBe(false);
    expect(res.min).toBe(2);
    expect(res.myCount).toBe(0);
  });
});
