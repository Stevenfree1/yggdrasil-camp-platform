'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MemberPortalLayout } from '../../../components/members/MemberPortalLayout';
import {
  Megaphone,
  Pin,
  Loader2,
  Search,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDate } from '../../../lib/utils';
import { getCampConfig } from '../../../lib/config';

const campName = getCampConfig().name;

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: Priority;
  publishedAt: string | null;
  createdAt: string;
  author: { id: string; name: string; playaName: string | null } | null;
  // derived client-side:
  pinned: boolean;
  category: string;
  date: string;
  authorName: string;
}

// Priority → display config. Schema only stores priority; pinned/category
// are derived in the UI so this mapping stays in one place.
const priorityConfig: Record<Priority, { label: string; color: string; pinned: boolean }> = {
  URGENT: { label: 'Urgent', color: 'bg-red-50 text-red-700 border-red-200', pinned: true },
  HIGH:   { label: 'Important', color: 'bg-gold/10 text-gold border-gold/20', pinned: true },
  NORMAL: { label: 'General', color: 'bg-sage/10 text-sage border-sage/20', pinned: false },
  LOW:    { label: 'FYI', color: 'bg-cream text-ink-soft border-line/30', pinned: false },
};

async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await fetch(`/api/trpc/announcements.list?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load announcements');
  const json = await res.json();
  const list = json.result?.data?.json?.announcements ?? [];
  return list.map((a: any) => {
    const cfg = priorityConfig[a.priority as Priority] || priorityConfig.NORMAL;
    return {
      ...a,
      pinned: cfg.pinned,
      category: cfg.label.toLowerCase(),
      date: a.publishedAt || a.createdAt,
      authorName: a.author?.name || campName,
    };
  });
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/members');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnnouncements()
        .then((data) => setAnnouncements(data))
        .catch(() => setAnnouncements([]))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-gold)' }} />
      </div>
    );
  }

  const filtered = announcements.filter((ann) => {
    const matchesSearch =
      searchQuery === '' ||
      ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ann.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || ann.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const pinned = filtered.filter((a) => a.pinned);
  const unpinned = filtered.filter((a) => !a.pinned);

  return (
    <MemberPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--color-ink)' }}>Announcements</h1>
          <p className="text-body-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
            Stay up to date with the latest news and updates from {campName}.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-ink-soft)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements..."
              className="form-input pl-10 text-sm"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="form-input w-auto min-w-[140px] text-sm"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="important">Important</option>
            <option value="general">General</option>
            <option value="fyi">FYI</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-gold)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="luxury-card p-12 text-center hover:translate-y-0">
            <AlertCircle className="h-10 w-10 mx-auto mb-4" style={{ color: 'rgba(74, 74, 66, 0.4)' }} />
            <h3 className="font-display text-xl mb-2" style={{ color: 'var(--color-ink)' }}>No Announcements Found</h3>
            <p className="text-body-relaxed text-sm" style={{ color: 'var(--color-ink-soft)' }}>
              {searchQuery || filterCategory !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'There are no announcements at this time.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pinned Announcements */}
            {pinned.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-gold)' }}>
                  <Pin className="h-3.5 w-3.5" />
                  Pinned
                </div>
                {pinned.map((ann) => (
                  <AnnouncementCard key={ann.id} announcement={ann} />
                ))}
              </div>
            )}

            {/* Regular Announcements */}
            {unpinned.length > 0 && (
              <div className="space-y-3">
                {pinned.length > 0 && (
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider pt-2" style={{ color: 'var(--color-ink-soft)' }}>
                    Recent
                  </div>
                )}
                {unpinned.map((ann) => (
                  <AnnouncementCard key={ann.id} announcement={ann} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MemberPortalLayout>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const config = priorityConfig[announcement.priority] || priorityConfig.NORMAL;

  return (
    <div className="luxury-card p-6 hover:translate-y-0">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3">
          {announcement.pinned && (
            <Pin className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-gold)' }} />
          )}
          <h3 className="text-lg font-semibold leading-snug" style={{ color: 'var(--color-ink)' }}>
            {announcement.title}
          </h3>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
          {config.label}
        </span>
      </div>
      <p className="text-body-relaxed text-sm mb-4 leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--color-ink-soft)' }}>
        {announcement.content}
      </p>
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-ink-soft)' }}>
        <span className="font-medium">{announcement.authorName}</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span>{formatDate(announcement.date)}</span>
      </div>
    </div>
  );
}
