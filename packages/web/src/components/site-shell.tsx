'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Navigation } from './navigation';
import { Footer } from './footer';

const chromeHiddenPrefixes = [
  '/admin',
  '/portal',
  '/members',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/invite',
];

function shouldHidePublicChrome(pathname: string): boolean {
  return chromeHiddenPrefixes.some((prefix) => {
    if (pathname === prefix) return true;
    return pathname.startsWith(`${prefix}/`);
  });
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hidePublicChrome = shouldHidePublicChrome(pathname);
  const isOperationsArea = ['/admin', '/portal', '/members'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return (
    <div className={isOperationsArea ? undefined : 'public-site'}>
      {!hidePublicChrome && <Navigation />}
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      {!hidePublicChrome && <Footer variant="ink" />}
    </div>
  );
}
