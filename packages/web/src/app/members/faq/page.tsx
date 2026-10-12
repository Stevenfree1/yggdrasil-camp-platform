'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MemberPortalLayout } from '../../../components/members/MemberPortalLayout';
import {
  HelpCircle,
  Search,
  Loader2,
  ChevronDown,
  Heart,
  MapPin,
  Zap,
  Utensils,
  Droplet,
  DoorClosed,
  ShowerHead,
  Tent,
  Music,
  Sparkles,
  Truck,
  HeartPulse,
  BadgeDollarSign,
  Users,
  Backpack,
  Hammer,
  Phone,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { memberFaq } from '../../../../../../config/member-faq.config';
import { getCampConfig } from '../../../lib/config';

const iconMap: Record<string, LucideIcon> = {
  heart: Heart,
  'map-pin': MapPin,
  zap: Zap,
  utensils: Utensils,
  droplet: Droplet,
  'door-closed': DoorClosed,
  'shower-head': ShowerHead,
  tent: Tent,
  music: Music,
  sparkles: Sparkles,
  truck: Truck,
  'heart-pulse': HeartPulse,
  'badge-dollar-sign': BadgeDollarSign,
  users: Users,
  backpack: Backpack,
  hammer: Hammer,
  phone: Phone,
};

export default function FaqPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/members');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-gold)' }} />
      </div>
    );
  }

  const query = searchQuery.trim().toLowerCase();
  const searching = query !== '';

  const filtered = memberFaq
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          !searching ||
          item.q.toLowerCase().includes(query) ||
          item.a.toLowerCase().includes(query),
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <MemberPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--color-ink)' }}>
            Member FAQ
          </h1>
          <p className="text-body-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
            Answers to the questions every {getCampConfig().memberNoun.singular} asks before the burn.
          </p>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: 'var(--color-ink-soft)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the FAQ..."
            className="form-input pl-10 text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="luxury-card p-12 text-center hover:translate-y-0">
            <HelpCircle className="h-10 w-10 mx-auto mb-4" style={{ color: 'rgba(74, 74, 66, 0.4)' }} />
            <h3 className="font-display text-xl mb-2" style={{ color: 'var(--color-ink)' }}>
              No answers found
            </h3>
            <p className="text-body-relaxed text-sm" style={{ color: 'var(--color-ink-soft)' }}>
              Try a different search term, or reach out to a camp lead.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-sm text-gold hover:text-gold/80 font-medium transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filtered.map((cat) => {
              const Icon = iconMap[cat.icon] ?? HelpCircle;
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="h-4 w-4" style={{ color: 'var(--color-gold)' }} />
                    <h2 className="font-display text-lg" style={{ color: 'var(--color-ink)' }}>
                      {cat.title}
                    </h2>
                    <span className="text-xs ml-1" style={{ color: 'var(--color-ink-soft)' }}>
                      ({cat.items.length})
                    </span>
                  </div>

                  <div className="space-y-3">
                    {cat.items.map((item, i) => {
                      const key = `${cat.id}-${i}`;
                      const open = openKeys.has(key) || searching;
                      return (
                        <div key={key} className="luxury-card p-0 overflow-hidden hover:translate-y-0">
                          <button
                            onClick={() => toggle(key)}
                            aria-expanded={open}
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors"
                          >
                            <span
                              className="text-sm font-semibold leading-snug"
                              style={{ color: 'var(--color-ink)' }}
                            >
                              {item.q}
                            </span>
                            <ChevronDown
                              className="h-4 w-4 shrink-0 transition-transform duration-300"
                              style={{
                                color: 'var(--color-gold)',
                                transform: open ? 'rotate(180deg)' : 'none',
                              }}
                            />
                          </button>
                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.div
                                key="content"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div
                                  className="px-5 pb-4 text-sm leading-6"
                                  style={{ color: 'var(--color-ink-soft)' }}
                                >
                                  <div className="h-px mb-3 bg-gradient-to-r from-transparent via-gold to-transparent opacity-60" />
                                  {item.a}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
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
