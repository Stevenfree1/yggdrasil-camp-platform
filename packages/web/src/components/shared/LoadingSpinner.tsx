'use client';

import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="mr-3 h-6 w-6 animate-spin text-sage" />
      <span className="text-sm text-ink-soft">{text}</span>
    </div>
  );
}
