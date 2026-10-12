import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js middleware for route protection.
 *
 * Auth uses an httpOnly JWT cookie (`camp-session`). Middleware only checks
 * the cookie is present — the JWT itself is validated by tRPC procedures
 * on each API call (see packages/web/src/server/lib/auth.ts).
 *
 * Defense-in-depth:
 * - Server-side: middleware redirects to /login if no session cookie
 * - Client-side: AuthContext queries auth.getProfile and redirects on null
 * - API-side: tRPC procedures verify the JWT signature + expiry per request
 */

const PROTECTED_PATHS = ['/portal', '/admin', '/members'];
const AUTH_PAGES = ['/login', '/admin/login', '/forgot-password', '/reset-password', '/register'];
const SESSION_COOKIE = 'camp-session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;

  // Check if the current path is protected
  const isProtectedPath = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );

  // Allow /admin/login through even though /admin is protected
  const isAdminLoginPage = pathname === '/admin/login';

  // Check if the current path is an auth page (login, register, etc.)
  const isAuthPage = AUTH_PAGES.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );

  // Protected routes: redirect to login if no session cookie
  if (isProtectedPath && !isAdminLoginPage && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth pages: redirect to portal if already has session cookie
  // (client-side will handle proper role-based redirect)
  if (isAuthPage && hasSession) {
    const portalUrl = new URL('/portal', request.url);
    return NextResponse.redirect(portalUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all protected and auth paths
    '/portal/:path*',
    '/admin/:path*',
    '/members/:path*',
    '/login',
    '/admin/login',
    '/forgot-password',
    '/reset-password',
    '/register',
  ],
};
