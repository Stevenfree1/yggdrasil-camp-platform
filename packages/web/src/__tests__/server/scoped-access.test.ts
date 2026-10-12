/**
 * Scoped admin access is a security boundary, so the whole allow/deny matrix
 * is asserted rather than spot-checked.
 *
 * The builder is exercised through a real tRPC router with a fake context, so
 * these tests cover the actual middleware rather than a reimplementation of it.
 */
import { TRPCError } from '@trpc/server';

// superjson ships ESM only, which Jest will not transform. createCaller never
// serializes, so a stub transformer is enough to construct the router.
jest.mock('superjson', () => ({
  __esModule: true,
  default: {
    serialize: (v: unknown) => ({ json: v }),
    deserialize: (v: { json: unknown }) => v.json,
  },
}));

import { router, scopedProcedure, leadProcedure, managerProcedure } from '../../server/trpc';

jest.mock('../../server/lib/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), security: jest.fn() },
}));
import logger from '../../server/lib/logger';

const testRouter = router({
  inventoryList: scopedProcedure('INVENTORY', 'MANAGER').query(() => 'inventory'),
  shiftsList: scopedProcedure('SHIFTS', 'LEAD').query(() => 'shifts'),
  payments: managerProcedure.query(() => 'payments'),
  inventoryDelete: leadProcedure.mutation(() => 'deleted'),
});

type Role = 'LEAD' | 'MANAGER' | 'STAFF' | 'MEMBER';

function callerFor(role: Role, adminScopes: string[] = []) {
  return testRouter.createCaller({
    // Only the fields the middleware reads need to be real.
    user: { id: 'u1', email: `${role.toLowerCase()}@example.com`, name: role, role, adminScopes },
    prisma: {} as never,
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

describe('scopedProcedure allow/deny matrix', () => {
  const cases: {
    name: string;
    role: Role;
    scopes: string[];
    inventoryList: boolean;
    shiftsList: boolean;
    payments: boolean;
    inventoryDelete: boolean;
  }[] = [
    { name: 'LEAD', role: 'LEAD', scopes: [],
      inventoryList: true, shiftsList: true, payments: true, inventoryDelete: true },
    // A manager could already reach inventory, but never lead-gated shifts.
    { name: 'MANAGER', role: 'MANAGER', scopes: [],
      inventoryList: true, shiftsList: false, payments: true, inventoryDelete: false },
    { name: 'STAFF + INVENTORY', role: 'STAFF', scopes: ['INVENTORY'],
      inventoryList: true, shiftsList: false, payments: false, inventoryDelete: false },
    { name: 'STAFF + SHIFTS', role: 'STAFF', scopes: ['SHIFTS'],
      inventoryList: false, shiftsList: true, payments: false, inventoryDelete: false },
    { name: 'STAFF with no scopes', role: 'STAFF', scopes: [],
      inventoryList: false, shiftsList: false, payments: false, inventoryDelete: false },
    // Scopes grant reach regardless of base role — deliberate, so a scope can
    // be handed out without also changing someone's role.
    { name: 'MEMBER + INVENTORY', role: 'MEMBER', scopes: ['INVENTORY'],
      inventoryList: true, shiftsList: false, payments: false, inventoryDelete: false },
    { name: 'MEMBER', role: 'MEMBER', scopes: [],
      inventoryList: false, shiftsList: false, payments: false, inventoryDelete: false },
  ];

  for (const c of cases) {
    it(`${c.name}`, async () => {
      const caller = callerFor(c.role, c.scopes);
      await expect(allowed(() => caller.inventoryList())).resolves.toBe(c.inventoryList);
      await expect(allowed(() => caller.shiftsList())).resolves.toBe(c.shiftsList);
      await expect(allowed(() => caller.payments())).resolves.toBe(c.payments);
      await expect(allowed(() => caller.inventoryDelete())).resolves.toBe(c.inventoryDelete);
    });
  }
});

describe('scopedProcedure denials are recorded', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs a security line naming the missing scope', async () => {
    const caller = callerFor('MEMBER');
    await expect(caller.inventoryList()).rejects.toThrow(TRPCError);
    expect(logger.security).toHaveBeenCalledTimes(1);
    expect(String((logger.security as jest.Mock).mock.calls[0][0])).toContain('INVENTORY');
  });

  it('does not log when access is granted', async () => {
    const caller = callerFor('STAFF', ['INVENTORY']);
    await expect(caller.inventoryList()).resolves.toBe('inventory');
    expect(logger.security).not.toHaveBeenCalled();
  });

  it('reports the scope, not the internal role, in the error message', async () => {
    const caller = callerFor('STAFF', ['SHIFTS']);
    await expect(caller.inventoryList()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'inventory access required',
    });
  });
});
