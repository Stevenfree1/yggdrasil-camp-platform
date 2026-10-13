'use client';

import { useState, useEffect, useRef, memo, forwardRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Menu, X, Sun, Moon, ArrowRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '../lib/utils';
import { useBrandConfig, useCampConfig, useContentConfig } from '../hooks/useConfig';
import { useAuth, hasAdminAccess } from '../contexts/AuthContext';

/**
 * Public top navigation (landing page and /apply). Member, portal, and admin
 * areas render their own chrome; see site-shell.tsx.
 *
 * Links come from contentConfig.navigation. The right-hand action switches
 * between "Log in" and "Portal" (plus "Admin" for admins) based on session.
 */
export const Navigation = memo(forwardRef(function Navigation(_props, _ref) {
  const campConfig = useCampConfig();
  const brand = useBrandConfig();
  const { navigation } = useContentConfig();
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const navItems = navigation.items;
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const accountLinks = isAuthenticated
    ? [
        { label: 'Portal', href: '/portal' },
        ...(hasAdminAccess(user) ? [{ label: 'Admin', href: '/admin' }] : []),
      ]
    : [{ label: 'Log in', href: '/login' }];

  // Add a little depth while scrolling.
  const { scrollY } = useScroll();
  const navShadowOpacity = useTransform(scrollY, [0, 80], [0, 1]);
  const navBoxShadow = useTransform(
    navShadowOpacity,
    (value) => `0 14px 36px rgba(var(--color-ink-rgb), ${value * 0.08})`
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Focus trap + Escape for the mobile menu
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const menuElement = mobileMenuRef.current;
    if (!menuElement) return;

    const focusableElements = menuElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    firstElement?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [isMobileMenuOpen]);

  return (
    <>
      <motion.nav
        aria-label="Main navigation"
        className="camp-navigation fixed top-0 left-0 right-0 z-50"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="absolute inset-0 backdrop-blur-xl border-b"
          style={{
            backgroundColor: 'rgba(var(--color-cream-rgb), 0.96)',
            borderColor: 'var(--color-warm-border)',
            boxShadow: navBoxShadow,
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{
            background: 'var(--color-rust)',
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 lg:h-24">
            {/* Logo + name lockup */}
            <Link
              href="/"
              className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 rounded-sm"
            >
              <Image
                src={brand.assets.logo}
                alt={campConfig.name}
                width={48}
                height={48}
                className="h-10 sm:h-12 w-auto object-contain transition-transform duration-500 group-hover:scale-105"
              />
              <span className="flex flex-col leading-none">
                <span
                  className="camp-wordmark text-2xl sm:text-3xl font-display uppercase tracking-tight"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {campConfig.name}
                </span>
                <span
                  className="camp-lockup-note mt-1 block text-[9px] sm:text-[10px] leading-tight uppercase tracking-[0.08em] font-body"
                  style={{ color: 'var(--color-ink-soft)' }}
                >
                  {navigation.lockupSubtitle}
                </span>
              </span>
            </Link>

            {/* Desktop links */}
            <div className="hidden lg:flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group relative rounded-sm px-4 py-2 text-xs uppercase tracking-[0.08em] font-semibold transition-colors duration-300',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2',
                    isActive(item.href) ? 'text-ink' : 'text-ink-soft hover:text-ink'
                  )}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {isActive(item.href) && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-sm"
                      style={{ backgroundColor: 'rgba(var(--color-gold-rgb), 0.14)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {mounted && (
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors text-ink-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2"
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
                  ) : (
                    <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
                  )}
                </button>
              )}

              {accountLinks.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn('hidden md:inline-flex', i === 0 ? 'cta-secondary' : 'cta-primary')}
                >
                  <span>{link.label}</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              ))}

              <button
                ref={mobileMenuButtonRef}
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-soft hover:text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 rounded-sm"
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-menu"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ backgroundColor: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }}
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            <motion.div
              ref={mobileMenuRef}
              id="mobile-menu"
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm lg:hidden overflow-y-auto"
              style={{ backgroundColor: 'var(--color-cream)', borderLeft: '1px solid var(--color-warm-border)' }}
              aria-label="Mobile navigation menu"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="flex items-center justify-between px-6 h-16"
                style={{ borderBottom: '1px solid var(--color-warm-border)' }}
              >
                <span className="font-display text-lg tracking-tight" style={{ color: 'var(--color-ink)' }}>
                  {campConfig.name}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" style={{ color: 'var(--color-ink)' }} aria-hidden="true" />
                </button>
              </div>

              <div className="px-6 py-8">
                <nav aria-label="Mobile navigation">
                  <ul className="space-y-1">
                    {navItems.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center -mx-3 rounded-full px-3 py-3.5 text-lg font-display transition-colors duration-200',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta',
                            isActive(item.href)
                              ? 'bg-gold/25 text-ink dark:bg-gold/35'
                              : 'text-ink-soft hover:bg-gold/25 hover:text-ink dark:hover:bg-gold/35'
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                          aria-current={isActive(item.href) ? 'page' : undefined}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                <div className="mt-10 space-y-4">
                  {accountLinks.map((link, i) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn('w-full', i === 0 ? 'cta-primary' : 'cta-secondary')}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span>{link.label}</span>
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}));
