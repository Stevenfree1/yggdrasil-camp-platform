'use client';

import { type LucideIcon } from 'lucide-react';
import { m } from 'framer-motion';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtext?: string;
  index?: number;
}

export function StatCard({ icon: Icon, label, value, subtext, index = 0 }: StatCardProps) {
  return (
    <m.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="luxury-card ledger-stat-card p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">{label}</p>
          <p className="mt-3 text-display-thin text-3xl leading-none text-ink tabular-nums">{value}</p>
        </div>
        <div className="admin-icon-box h-10 w-10 shrink-0">
          <Icon className="h-5 w-5 text-gold" />
        </div>
      </div>
      {subtext && (
        <p className="text-xs text-ink-soft">{subtext}</p>
      )}
    </m.div>
  );
}
