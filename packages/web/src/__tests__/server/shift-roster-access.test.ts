/**
 * A SHIFTS scope holder must be able to read the names they are allowed to
 * assign. Granting every shifts.* mutation while the roster read stayed
 * manager-only left the assign dialog stuck on "loading roster" (reported from
 * the field, 2026-08-20).
 *
 * Exercised through the real router with a fake prisma, so this covers the
 * actual procedure wiring rather than a restatement of the middleware.
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

const ROW = {
  id: 'sm1',
  member: {
    id: 'm1',
    name: 'Alex Doe',
    playaName: null,
    email: 'ali@example.com',
    // Fields the narrow select must never pull through.
    phone: '555-0100',
  },
  duesStatus: 'UNPAID',
  housingType: 'RV',
};

/**
 * findMany honours `select` the way prisma does, so "no dues, no phone" is a
 * claim about the query the router builds rather than about the stub.
 */
function project(row: Record<string, unknown>, select: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(select)) {
    if (!spec || !(key in row)) continue;
    out[key] =
      typeof spec === 'object' && spec !== null && 'select' in spec
        ? project(row[key] as Record<string, unknown>, (spec as { select: Record<string, unknown> }).select)
        : row[key];
  }
  return out;
}

function makePrisma() {
  return {
    season: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
    seasonMember: {
      findMany: jest.fn(async (args: { select?: Record<string, unknown> }) =>
        args.select ? [project(ROW, args.select)] : [ROW],
      ),
    },
  } as never;
}

function callerFor(role: string, adminScopes: string[] = []) {
  return shiftsRouter.createCaller({
    user: { id: 'u1', email: 'x@example.com', name: role, role, adminScopes },
    prisma: makePrisma(),
    cookieStore: {} as never,
  } as never);
}

async function allowed(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'FORBIDDEN') return false;
    throw e;
  }
}

describe('shifts.assignableMembers access', () => {
  it('lets a SHIFTS scope holder read the roster', async () => {
    const caller = callerFor('MEMBER', ['SHIFTS']);
    await expect(allowed(() => caller.assignableMembers({}))).resolves.toBe(true);
  });

  it('still lets LEAD and MANAGER read it', async () => {
    await expect(allowed(() => callerFor('LEAD').assignableMembers({}))).resolves.toBe(true);
    await expect(allowed(() => callerFor('MANAGER').assignableMembers({}))).resolves.toBe(true);
  });

  it('denies a member with no scope', async () => {
    await expect(allowed(() => callerFor('MEMBER').assignableMembers({}))).resolves.toBe(false);
  });

  it('denies a holder of a different scope', async () => {
    await expect(allowed(() => callerFor('MEMBER', ['INVENTORY']).assignableMembers({}))).resolves.toBe(false);
  });
});

describe('shifts.assignableMembers payload', () => {
  it('returns only what the assign picker needs', async () => {
    const caller = callerFor('MEMBER', ['SHIFTS']);
    const res = (await caller.assignableMembers({})) as {
      seasonMembers: { id: string; member: Record<string, unknown> }[];
    };
    expect(res.seasonMembers).toHaveLength(1);
    const [row] = res.seasonMembers;
    expect(row.id).toBe('sm1');
    expect(row.member.name).toBe('Alex Doe');
    // Dues, housing and phone are not shift data and must not ride along.
    expect(row).not.toHaveProperty('duesStatus');
    expect(row).not.toHaveProperty('housingType');
    expect(row.member).not.toHaveProperty('phone');
  });

  it('asks prisma for a narrow select, not the whole season member', async () => {
    const prisma = makePrisma() as unknown as {
      seasonMember: { findMany: jest.Mock };
    };
    const caller = shiftsRouter.createCaller({
      user: { id: 'u1', email: 'x@example.com', name: 'L', role: 'LEAD', adminScopes: [] },
      prisma,
      cookieStore: {} as never,
    } as never);
    await caller.assignableMembers({});
    const args = prisma.seasonMember.findMany.mock.calls[0][0];
    expect(args.select).toBeDefined();
    expect(args.select.duesStatus).toBeUndefined();
    expect(args.select.member.select.phone).toBeUndefined();
  });
});
