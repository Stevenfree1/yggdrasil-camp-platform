'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}
