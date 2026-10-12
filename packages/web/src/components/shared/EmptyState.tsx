'use client';

import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="admin-icon-box mb-4 h-14 w-14">
        <Icon className="h-7 w-7 text-gold" />
      </div>
      <h3 className="mb-2 text-display-thin text-xl text-ink">{title}</h3>
      <p className="text-body-relaxed max-w-sm text-sm text-ink-soft">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="cta-primary mt-6 px-6 py-2.5 text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
