'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MemberPortalLayout } from '../../../components/members/MemberPortalLayout';
import {
  FolderOpen,
  Search,
  Loader2,
  ExternalLink,
  BookOpen,
  FileText,
  Link2,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { memberResources, type CampResource } from '../../../../../../config/member-resources.config';
import { getIcon } from '../../../lib/icons';
import { getCampConfig } from '../../../lib/config';
import { formatDate } from '../../../lib/utils';

const categoryConfig: Record<string, { label: string; color: string; icon: typeof BookOpen }> = {
  guide: { label: 'Guide', color: 'bg-green-50 text-green-700 border-green-200', icon: BookOpen },
  form: { label: 'Form', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: ClipboardList },
  document: { label: 'Document', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: FileText },
  link: { label: 'Link', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Link2 },
};

export default function ResourcesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [resources, setResources] = useState<CampResource[]>([]);
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
      // Resources are static config — no fetch needed.
      setResources(memberResources);
      setLoading(false);
    }
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-gold)' }} />
      </div>
    );
  }

  const filtered = resources.filter((res) => {
    const matchesSearch =
      searchQuery === '' ||
      res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || res.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const grouped = filtered.reduce<Record<string, CampResource[]>>((acc, res) => {
    if (!acc[res.category]) acc[res.category] = [];
    acc[res.category].push(res);
    return acc;
  }, {});

  const categoryOrder = ['guide', 'form', 'document', 'link'];

  return (
    <MemberPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--color-ink)' }}>Camp Resources</h1>
          <p className="text-body-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
            Guides, documents, forms, and useful links for {getCampConfig().name} members.
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
              placeholder="Search resources..."
              className="form-input pl-10 text-sm"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="form-input w-auto min-w-[140px] text-sm"
          >
            <option value="all">All Types</option>
            <option value="guide">Guides</option>
            <option value="form">Forms</option>
            <option value="document">Documents</option>
            <option value="link">Links</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-gold)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="luxury-card p-12 text-center hover:translate-y-0">
            <FolderOpen className="h-10 w-10 mx-auto mb-4" style={{ color: 'rgba(74, 74, 66, 0.4)' }} />
            <h3 className="font-display text-xl mb-2" style={{ color: 'var(--color-ink)' }}>No Resources Found</h3>
            <p className="text-body-relaxed text-sm" style={{ color: 'var(--color-ink-soft)' }}>
              {searchQuery || filterCategory !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No resources are available at this time.'}
            </p>
            {(searchQuery || filterCategory !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setFilterCategory('all'); }}
                className="mt-4 text-sm text-gold hover:text-gold/80 font-medium transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : filterCategory !== 'all' ? (
          // Flat list when filtering
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((res) => (
              <ResourceCard key={res.id} resource={res} />
            ))}
          </div>
        ) : (
          // Grouped view
          <div className="space-y-8">
            {categoryOrder.map((cat) => {
              const items = grouped[cat];
              if (!items || items.length === 0) return null;
              const config = categoryConfig[cat] || categoryConfig.guide;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-4">
                    <config.icon className="h-4 w-4" style={{ color: 'var(--color-gold)' }} />
                    <h2 className="font-display text-lg" style={{ color: 'var(--color-ink)' }}>{config.label}s</h2>
                    <span className="text-xs ml-1" style={{ color: 'var(--color-ink-soft)' }}>({items.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((res) => (
                      <ResourceCard key={res.id} resource={res} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MemberPortalLayout>
  );
}

function ResourceCard({ resource }: { resource: CampResource }) {
  const config = categoryConfig[resource.category] || categoryConfig.guide;
  const IconComponent = getIcon(resource.icon);
  const hasValidUrl = resource.url && resource.url !== '#';

  return (
    <a
      href={hasValidUrl ? resource.url : undefined}
      target={hasValidUrl ? '_blank' : undefined}
      rel={hasValidUrl ? 'noopener noreferrer' : undefined}
      aria-disabled={!hasValidUrl}
      onClick={(e) => {
        if (!hasValidUrl) e.preventDefault();
      }}
      className={`luxury-card p-5 group block ${!hasValidUrl ? 'cursor-not-allowed opacity-70' : ''}`}
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-gold/10 border border-gold/20 shrink-0 group-hover:bg-gold/20 transition-colors">
          <IconComponent className="h-5 w-5" style={{ color: 'var(--color-gold)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h3 className="text-sm font-semibold group-hover:text-gold transition-colors leading-snug" style={{ color: 'var(--color-ink)' }}>
              {resource.title}
            </h3>
            <ExternalLink className="h-3.5 w-3.5 group-hover:text-gold shrink-0 mt-0.5 transition-colors" style={{ color: 'rgba(74, 74, 66, 0.4)' }} />
          </div>
          <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--color-ink-soft)' }}>{resource.description}</p>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${config.color}`}>
              {config.label}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--color-ink-soft)' }}>
              Updated {formatDate(resource.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
