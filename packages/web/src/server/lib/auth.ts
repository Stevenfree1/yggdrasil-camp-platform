import jwt from 'jsonwebtoken';
import type { CookieStore } from '../context';

export const SESSION_COOKIE = 'camp-session';
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not configured');
  return secret;
}

export function signSessionToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, getJwtSecret(), { expiresIn: '7d' });
}

export function signInviteToken(memberId: string): string {
  return jwt.sign({ memberId, type: 'invite' }, getJwtSecret(), { expiresIn: '30d' });
}

export function signResetToken(memberId: string): string {
  return jwt.sign({ memberId, type: 'reset' }, getJwtSecret(), { expiresIn: '1h' });
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (typeof decoded === 'object' && decoded !== null) {
      return decoded as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function setSessionCookie(cookieStore: CookieStore, token: string) {
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
}

export function clearSessionCookie(cookieStore: CookieStore) {
  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
