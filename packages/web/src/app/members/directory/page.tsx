'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MemberPortalLayout } from '../../../components/members/MemberPortalLayout';
import { Avatar } from '../../../components/shared/Avatar';
import {
  Users,
  User,
  Search,
  Loader2,
  AlertCircle,
  Shield,
  Star,
  X,
  Mail,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { getCampConfig } from '../../../lib/config';

const camp = getCampConfig();

type RoleKey = 'LEAD' | 'MANAGER' | 'MEMBER';

interface DirectoryMember {
  id: string;
  name: string;
  playaName: string | null;
  role: RoleKey;
  hasAvatar: boolean;
  joinedYear: number | null;
  bio?: string;
  skills?: string[];
}

async function fetchDirectory(): Promise<DirectoryMember[]> {
  const res = await fetch(`/api/trpc/members.getDirectory?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load directory');
  const json = await res.json();
  return (json.result?.data?.json ?? []) as DirectoryMember[];
}

const roleConfig: Record<RoleKey, { label: string; color: string; icon: typeof Shield }> = {
  LEAD: { label: 'Camp Lead', color: 'bg-gold/10 text-gold border-gold/20', icon: Star },
  MANAGER: { label: 'Manager', color: 'bg-sage/10 text-sage border-sage/20', icon: Shield },
  MEMBER: { label: 'Member', color: 'bg-cream text-ink-soft border-line/30', icon: User },
};

const ROLE_FILTERS: Array<{ value: 'all' | RoleKey; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'LEAD', label: 'Leads' },
  { value: 'MANAGER', label: 'Managers' },
  { value: 'MEMBER', label: 'Members' },
];

export default function DirectoryPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [directory, setDirectory] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | RoleKey>('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/members');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDirectory()
        .then((data) => setDirectory(data))
        .catch(() => setDirectory([]))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return directory.filter((member) => {
      const matchesSearch =
        query === '' ||
        member.name.toLowerCase().includes(query) ||
        (member.playaName && member.playaName.toLowerCase().includes(query)) ||
        (member.bio && member.bio.toLowerCase().includes(query)) ||
        (member.skills && member.skills.some((s) => s.toLowerCase().includes(query)));
      const matchesRole = filterRole === 'all' || member.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [directory, searchQuery, filterRole]);

  const sorted = useMemo(() => {
    const sortOrder: Record<string, number> = { LEAD: 0, MANAGER: 1, MEMBER: 2 };
    return [...filtered].sort((a, b) => (sortOrder[a.role] ?? 3) - (sortOrder[b.role] ?? 3));
  }, [filtered]);

  const hasActiveFilters = searchQuery.trim() !== '' || filterRole !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterRole('all');
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-gold)' }} aria-hidden="true" />
        <span className="sr-only">Loading directory</span>
      </div>
    );
  }

  return (
    <MemberPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <header>
          <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--color-ink)' }}>
            Member Directory
          </h1>
          <p className="text-body-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
            Connect with fellow {camp.name} members.{' '}
            {!loading && (
              <span>{directory.length} members in our community.</span>
            )}
          </p>
        </header>

        {/* Filters */}
        <section
          role="search"
          aria-label="Filter member directory"
          className="space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <label htmlFor="directory-search" className="sr-only">
                Search members
              </label>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: 'var(--color-ink-soft)' }}
                aria-hidden="true"
              />
              <input
                id="directory-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, playa name, or skill..."
                className="form-input pl-10 pr-10 text-sm w-full"
                aria-describedby="directory-results-count"
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-cream/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 transition-colors"
                >
                  <X className="h-3.5 w-3.5" style={{ color: 'var(--color-ink-soft)' }} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Role filter pills (better keyboard nav than select) */}
          <div
            role="tablist"
            aria-label="Filter by role"
            className="flex flex-wrap gap-2"
          >
            {ROLE_FILTERS.map((opt) => {
              const active = filterRole === opt.value;
              return (
                <button
                  key={opt.value}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilterRole(opt.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                    active
                      ? 'bg-gold/10 text-gold border-gold/30'
                      : 'bg-cream/60 text-ink-soft border-line/30 hover:bg-cream'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium border border-transparent text-gold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 transition-colors"
                aria-label="Clear all filters"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Live results count */}
          <p
            id="directory-results-count"
            className="text-xs"
            style={{ color: 'var(--color-ink-soft)' }}
            aria-live="polite"
            aria-atomic="true"
          >
            {loading
              ? 'Loading members...'
              : `Showing ${sorted.length} of ${directory.length} member${directory.length === 1 ? '' : 's'}`}
          </p>
        </section>

        {loading ? (
          <DirectorySkeleton />
        ) : sorted.length === 0 ? (
          <EmptyState hasActiveFilters={hasActiveFilters} onClear={clearFilters} />
        ) : (
          <ul
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            aria-label="Member list"
          >
            {sorted.map((member) => (
              <li key={member.id}>
                <MemberCard member={member} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </MemberPortalLayout>
  );
}

function DirectorySkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      role="status"
      aria-label="Loading members"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="luxury-card p-5 hover:translate-y-0">
          <div className="flex items-start gap-4 animate-pulse">
            <div
              className="w-14 h-14 rounded-full shrink-0"
              style={{ backgroundColor: 'rgba(74, 74, 66, 0.08)' }}
            />
            <div className="flex-1 space-y-2.5">
              <div
                className="h-3.5 rounded w-1/2"
                style={{ backgroundColor: 'rgba(74, 74, 66, 0.12)' }}
              />
              <div
                className="h-3 rounded w-1/3"
                style={{ backgroundColor: 'rgba(74, 74, 66, 0.08)' }}
              />
              <div
                className="h-3 rounded w-full"
                style={{ backgroundColor: 'rgba(74, 74, 66, 0.06)' }}
              />
              <div
                className="h-3 rounded w-4/5"
                style={{ backgroundColor: 'rgba(74, 74, 66, 0.06)' }}
              />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading directory members</span>
    </div>
  );
}

function EmptyState({
  hasActiveFilters,
  onClear,
}: {
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="luxury-card p-12 text-center hover:translate-y-0">
      <div
        className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'rgba(212, 175, 55, 0.08)' }}
        aria-hidden="true"
      >
        <Users className="h-7 w-7" style={{ color: 'var(--color-gold)', opacity: 0.7 }} />
      </div>
      <h2 className="font-display text-xl mb-2" style={{ color: 'var(--color-ink)' }}>
        {hasActiveFilters ? 'No matching members' : 'No members yet'}
      </h2>
      <p className="text-body-relaxed text-sm max-w-sm mx-auto" style={{ color: 'var(--color-ink-soft)' }}>
        {hasActiveFilters
          ? 'We could not find anyone matching that search. Try a different name, playa name, or skill.'
          : 'The member directory is empty. Check back soon as the community grows.'}
      </p>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="cta-secondary mt-5 text-sm"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: DirectoryMember }) {
  const role = roleConfig[member.role] || roleConfig.MEMBER;
  const RoleIcon = role.icon;
  const contactHref = `mailto:${camp.email}?subject=${encodeURIComponent(
    `Hello ${member.name} via ${camp.name}`,
  )}`;

  return (
    <article
      className="luxury-card p-5 hover:translate-y-0 h-full flex flex-col"
      aria-labelledby={`member-${member.id}-name`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar (photo or initials fallback) */}
        <Avatar
          name={member.name}
          memberId={member.id}
          hasAvatar={member.hasAvatar}
          size="lg"
        />

        {/* Info */}
        <div className="min-w-0 flex-1">
          {/* Name + role badge */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3
              id={`member-${member.id}-name`}
              className="text-sm font-semibold leading-snug truncate"
              style={{ color: 'var(--color-ink)' }}
            >
              {member.name}
            </h3>
            <span
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${role.color}`}
            >
              <RoleIcon className="h-2.5 w-2.5" aria-hidden="true" />
              {role.label}
            </span>
          </div>

          {/* Meta line: playa name + joined year */}
          <p className="text-xs mb-2" style={{ color: 'var(--color-ink-soft)' }}>
            {member.playaName && (
              <>
                <span style={{ color: 'var(--color-gold)' }} className="font-medium">
                  &ldquo;{member.playaName}&rdquo;
                </span>
                <span className="mx-1.5 opacity-50" aria-hidden="true">&middot;</span>
              </>
            )}
            {member.joinedYear ? <span>Member since {member.joinedYear}</span> : <span>Member</span>}
          </p>

          {/* Bio snippet */}
          {member.bio && (
            <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--color-ink-soft)' }}>
              {member.bio}
            </p>
          )}
        </div>
      </div>

      {/* Skills */}
      {member.skills && member.skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mt-1" aria-label={`${member.name}'s skills`}>
          {member.skills.map((skill) => (
            <li
              key={skill}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border border-line/20"
              style={{ backgroundColor: 'var(--color-cream)', color: 'var(--color-ink-soft)' }}
            >
              {skill}
            </li>
          ))}
        </ul>
      )}

      {/* Contact action */}
      <div className="mt-4 pt-3 border-t border-line/20 flex items-center justify-end">
        <a
          href={contactHref}
          aria-label={`Send a message to ${member.name}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-line/30 hover:border-gold/40 hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 transition-colors"
          style={{ color: 'var(--color-ink-soft)' }}
        >
          <Mail className="h-3 w-3" aria-hidden="true" />
          Message
        </a>
      </div>
    </article>
  );
}
