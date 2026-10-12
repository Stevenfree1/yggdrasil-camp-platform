'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-24 px-5">
      <div className="max-w-md w-full text-center">
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
          style={{
            backgroundColor: 'rgba(var(--color-gold-rgb), 0.15)',
            border: '1px solid rgba(var(--color-gold-rgb), 0.25)',
          }}
        >
          <svg
            className="h-7 w-7"
            style={{ color: 'var(--color-gold)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h2
          className="font-display text-xl mb-2"
          style={{ color: 'var(--color-ink)' }}
        >
          Admin Error
        </h2>
        <p
          className="font-body text-sm mb-6 leading-relaxed"
          style={{ color: 'var(--color-ink-soft)' }}
        >
          Something went wrong in the admin section. This may be a temporary
          issue with the server or your session.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg text-sm font-medium bg-sage text-white hover:bg-sage-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
