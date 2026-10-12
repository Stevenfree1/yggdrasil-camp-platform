'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LogOut,
  LayoutDashboard,
  CreditCard,
  User,
  FolderOpen,
  Megaphone,
  HelpCircle,
  ClipboardList,
  Menu,
  X,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCampConfig } from '../../lib/config';

const campShortName = getCampConfig().shortName;
import { ThemeToggle } from '../theme-toggle';

// Single source of truth for the member nav. Rendered identically by the
// /portal route layout and the /members pages (via MemberPortalLayout) so the
// menu never changes shape as you move between the two areas.
export const memberNavItems = [
  { label: 'Dashboard', href: '/portal', icon: LayoutDashboard, exact: true },
  { label: 'Announcements', href: '/members/announcements', icon: Megaphone },
  { label: 'Payments', href: '/portal/payments', icon: CreditCard },
  { label: 'Shifts', href: '/portal/shifts', icon: ClipboardList },
  { label: 'Resources', href: '/members/resources', icon: FolderOpen },
  { label: 'FAQ', href: '/members/faq', icon: HelpCircle },
  { label: 'Profile', href: '/portal/profile', icon: User },
];

export function MemberPortalNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  // Shown next to the hamburger so mobile users always know where they are.
  const activeLabel =
    memberNavItems.find((i) => isActive(i.href, i.exact))?.label ??
    (pathname.startsWith('/portal/lodging')
      ? 'Lodging'
      : pathname.startsWith('/members/directory')
        ? 'Directory'
        : 'Member Portal');

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="sticky top-0 z-40 border-b border-tan/40 bg-surface/95 backdrop-blur-md">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            <Link
              href="/"
              className="group relative flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-ink-soft hover:text-gold transition-colors whitespace-nowrap"
              title="Back to main site"
            >
              <span
                className="absolute inset-0 rounded-full bg-gold/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden="true"
              />
              <ArrowLeft className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">{campShortName}</span>
            </Link>
            <span className="mx-1 h-5 w-px bg-tan/40" aria-hidden="true" />
            {memberNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    active ? 'text-gold' : 'text-ink-soft hover:text-gold'
                  }`}
                >
                  {/* Active pill — a single highlight that slides between items. */}
                  {active && (
                    <motion.span
                      layoutId="member-nav-active"
                      className="absolute inset-0 rounded-full bg-gold/15"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      aria-hidden="true"
                    />
                  )}
                  {/* Hover pill (non-active) — same shape, fainter. */}
                  {!active && (
                    <span
                      className="absolute inset-0 rounded-full bg-gold/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5" />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile hamburger + current page label */}
          <div className="flex items-center gap-1 lg:hidden">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="p-2 text-ink-soft hover:text-gold transition-colors"
              aria-label="Toggle member navigation"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="text-sm font-medium text-ink">{activeLabel}</span>
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-xs text-ink-soft hidden sm:inline whitespace-nowrap">
              {user?.playaName || user?.name}
            </span>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-sage hover:text-gold transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileNavOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="lg:hidden border-t border-tan/20 bg-surface"
        >
          <div className="px-4 py-2 space-y-1">
            <Link
              href="/"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-ink-soft hover:text-gold transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {campShortName}
            </Link>
            <div className="my-1 h-px bg-tan/30" aria-hidden="true" />
            {memberNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active ? 'text-gold bg-gold/5 font-medium' : 'text-ink-soft hover:text-gold'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
