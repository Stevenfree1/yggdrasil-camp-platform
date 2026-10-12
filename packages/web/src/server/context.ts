import type { PrismaClient } from '@prisma/client';
import type { cookies as nextCookies } from 'next/headers';
import { prisma } from './lib/prisma';
import { SESSION_COOKIE, verifyToken } from './lib/auth';
import logger from './lib/logger';

export type CookieStore = ReturnType<typeof nextCookies>;

export interface UserContext {
  id: string;
  email: string;
  name: string;
  role: string;
  /** Per-area admin grants, re-read each request so revocation is immediate. */
  adminScopes: string[];
}

export interface Context {
  prisma: PrismaClient;
  user?: UserContext;
  ip?: string;
  cookieStore: CookieStore;
}

export interface CreateContextArgs {
  req: Request;
  cookieStore: CookieStore;
}

export async function createContext({
  req,
  cookieStore,
}: CreateContextArgs): Promise<Context> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined;

  const context: Context = {
    prisma,
    ip,
    cookieStore,
  };

  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return context;

  const decoded = verifyToken(token);
  if (
    !decoded ||
    typeof decoded.userId !== 'string' ||
    typeof decoded.role !== 'string'
  ) {
    logger.security('Invalid session cookie payload', { ip });
    return context;
  }

  const member = await prisma.member.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      adminScopes: true,
    },
  });

  if (member && member.isActive) {
    context.user = {
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      adminScopes: member.adminScopes ?? [],
    };
  } else if (member && !member.isActive) {
    logger.security(`Deactivated account attempted access: ${member.email}`, { ip });
  }

  return context;
}
