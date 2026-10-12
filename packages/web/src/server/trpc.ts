import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { Context } from './context';
import logger from './lib/logger';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const memberProcedure = t.procedure.use(({ ctx, next, path }) => {
  if (!ctx.user) {
    logger.security(`Unauthenticated access attempt on ${path}`, { ip: ctx.ip });
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const managerProcedure = memberProcedure.use(({ ctx, next, path }) => {
  if (ctx.user.role !== 'LEAD' && ctx.user.role !== 'MANAGER') {
    logger.security(
      `Permission denied: ${ctx.user.email} (${ctx.user.role}) attempted manager action on ${path}`,
    );
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Manager access required' });
  }
  return next();
});

export const leadProcedure = memberProcedure.use(({ ctx, next, path }) => {
  if (ctx.user.role !== 'LEAD') {
    logger.security(
      `Permission denied: ${ctx.user.email} (${ctx.user.role}) attempted lead action on ${path}`,
    );
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Lead access required' });
  }
  return next();
});

export const adminProcedure = leadProcedure;

/** Per-area admin grants. Mirrors the `AdminScope` enum in the schema. */
export type AdminScope = 'INVENTORY' | 'SHIFTS';

/**
 * A procedure a member may reach either by role or by holding a scope.
 *
 * `base` is the role that could already reach it before scopes existed, and is
 * what keeps this change additive: a procedure that was `managerProcedure`
 * becomes `scopedProcedure(x, 'MANAGER')` and a `leadProcedure` becomes
 * `scopedProcedure(x, 'LEAD')`, so nobody silently gains reach they did not
 * have. Scopes are then a third, independent way in.
 *
 * Scopes are read from the database on every request (see context.ts) rather
 * than carried in the session token, so revoking one takes effect immediately
 * instead of at next login.
 */
export function scopedProcedure(scope: AdminScope, base: 'MANAGER' | 'LEAD') {
  return memberProcedure.use(({ ctx, next, path }) => {
    const byRole =
      ctx.user.role === 'LEAD' || (base === 'MANAGER' && ctx.user.role === 'MANAGER');
    const byScope = (ctx.user.adminScopes ?? []).includes(scope);
    if (!byRole && !byScope) {
      logger.security(
        `Permission denied: ${ctx.user.email} (${ctx.user.role}) attempted ${path} — needs ${scope} scope or ${base}`,
      );
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `${scope.toLowerCase()} access required`,
      });
    }
    return next();
  });
}
