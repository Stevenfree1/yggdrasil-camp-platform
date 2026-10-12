'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  LogOut,
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  FileText,
  Mail,
  MailOpen,
  Upload,
  Menu,
  X,
  ChevronDown,
  ExternalLink,
  Receipt,
  Ticket,
  Hammer,
  Trash2,
  Map as MapIcon,
  Tag,
  Banknote,
  PackageSearch,
} from 'lucide-react';
import { useAuth, hasAdminAccess, canAccessScope, type AdminScope } from '../../contexts/AuthContext';
import { AdminSeasonProvider, useAdminSeason } from '../../contexts/AdminSeasonContext';
import { getCampConfig } from '@/lib/config';

const campConfig = getCampConfig();

/**
 * `scope` marks a section a scope holder may reach. Items without one are
 * visible to LEAD/MANAGER only. Filtering here is presentation: the tRPC
 * guards are the real boundary.
 */
const sidebarItems: {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  scope?: AdminScope;
}[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Members', href: '/admin/members', icon: Users },
  { label: 'Season', href: '/admin/season', icon: Calendar },
  { label: 'Build', href: '/admin/build', icon: Hammer },
  { label: 'Strike', href: '/admin/strike', icon: Trash2 },
  { label: 'Shifts', href: '/admin/shifts', icon: ClipboardList, scope: 'SHIFTS' },
  { label: 'Lodging', href: '/admin/lodging', icon: MapIcon },
  { label: 'Inventory', href: '/admin/inventory', icon: PackageSearch, scope: 'INVENTORY' },
  { label: 'Charges', href: '/admin/charges', icon: Tag },
  { label: 'Payments', href: '/admin/payments', icon: Banknote },
  { label: 'Expenses', href: '/admin/expenses', icon: Receipt },
  { label: 'Tickets', href: '/admin/tickets', icon: Ticket },
  { label: 'Applications', href: '/admin/applications', icon: FileText },
  { label: 'Communications', href: '/admin/communications', icon: Mail },
  { label: 'Email Log', href: '/admin/emails', icon: MailOpen },
  { label: 'Import / Export', href: '/admin/import', icon: Upload },
];

function SeasonSelector() {
  const { seasons, selectedSeasonId, setSelectedSeasonId, isLoading } = useAdminSeason();

  if (isLoading || seasons.length <= 1) return null;

  return (
    <select
      value={selectedSeasonId || ''}
      onChange={(e) => setSelectedSeasonId(e.target.value)}
      className="form-input w-auto min-w-[154px] border-white/20 bg-white/10 py-1.5 text-sm text-cream"
      aria-label="Select admin season"
    >
      {seasons.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}{s.isActive ? ' (Active)' : ''}
        </option>
      ))}
    </select>
  );
}
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Skip auth checks for the admin login page
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) return;
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
    if (!isLoading && isAuthenticated && user) {
      if (!hasAdminAccess(user)) {
        router.replace('/portal');
      }
    }
  }, [isLoading, isAuthenticated, user, router, isLoginPage, pathname]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
    setUserDropdownOpen(false);
  }, [pathname]);

  // For the login page, render children without admin chrome
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="admin-ledger fixed inset-0 z-[60] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-gold animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (!hasAdminAccess(user)) {
    return null;
  }

  // LEAD/MANAGER see everything; a scope holder sees Dashboard plus the
  // sections their scopes unlock.
  const isFullAdmin = user.role === 'LEAD' || user.role === 'MANAGER';
  const visibleItems = isFullAdmin
    ? sidebarItems
    : sidebarItems.filter(
        (item) => item.href === '/admin' || (item.scope && canAccessScope(user, item.scope)),
      );

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <AdminSeasonProvider>
    <div className="admin-ledger fixed inset-0 z-[60] flex overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center justify-between">
              <Link href="/admin" className="group flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-9 shrink-0 items-center justify-center border border-gold/40 bg-black/10 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
                  <Image
                    src="/images/brand/logo-256.webp"
                    alt=""
                    width={34}
                    height={48}
                    className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                    aria-hidden="true"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg leading-tight text-cream">
                    {campConfig.name}
                  </span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">
                    Operations Ledger
                  </span>
                </span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 text-white/60 transition-colors hover:text-white lg:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'border-gold/40 bg-gold/10 text-gold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'border-transparent text-white/70 hover:border-white/10 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer - user info */}
          <div className="space-y-3 border-t border-white/10 p-4">
            <div className="rounded-md border border-gold/25 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/80">
                Signed in
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 bg-gold/20">
                  <span className="text-sm font-medium text-gold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{user.name}</p>
                  <p className="truncate text-xs uppercase tracking-[0.14em] text-white/50">{user.role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top header bar */}
        <header className="admin-topbar z-30 border-b backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            {/* Left: hamburger + breadcrumb */}
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-md border border-white/10 p-2 text-ink-soft transition-colors hover:text-gold lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-gold sm:block">
                  Admin Console
                </p>
                <h2 className="truncate text-display-thin text-lg leading-tight text-ink">
                  {sidebarItems.find((item) => isActive(item.href))?.label || 'Admin'}
                </h2>
              </div>
            </div>

            {/* Right: season selector, notifications, user */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden md:block">
                <SeasonSelector />
              </div>
              <Link
                href="/"
                className="hidden items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-sm text-sage transition-colors hover:text-gold sm:inline-flex"
              >
                View Site
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 rounded-md border border-white/10 px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:text-gold"
                >
                  <span className="hidden sm:inline">{user.name}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="admin-user-menu luxury-card absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden p-0 shadow-lg"
                    >
                      <div className="p-3 border-b border-tan/20">
                        <p className="text-sm font-medium text-ink truncate">{user.name}</p>
                        <p className="text-xs text-ink-soft truncate">{user.email}</p>
                      </div>
                      <div className="p-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:bg-cream rounded-lg transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="admin-content flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
          {children}
        </main>
      </div>
    </div>
    </AdminSeasonProvider>
  );
}
