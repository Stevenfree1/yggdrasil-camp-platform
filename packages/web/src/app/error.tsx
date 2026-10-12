'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, Home, AlertTriangle } from 'lucide-react';
import { getCampConfig } from '@/lib/config';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { email } = getCampConfig();

  useEffect(() => {
    console.error('Root error boundary caught:', error);
  }, [error]);

  return (
    <main
      className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-20 overflow-hidden"
      style={{ backgroundColor: 'var(--color-cream)' }}
    >
      <div className="pattern-geometric absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true" />
      <div className="mountain-silhouette absolute inset-x-0 bottom-0 pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-xl w-full text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
          style={{
            backgroundColor: 'rgba(var(--color-gold-rgb), 0.12)',
            border: '1px solid rgba(var(--color-gold-rgb), 0.3)',
          }}
          aria-hidden="true"
        >
          <AlertTriangle
            className="h-7 w-7"
            style={{ color: 'var(--color-gold)' }}
            strokeWidth={1.5}
          />
        </div>

        <div className="ornate-divider mb-6" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ color: 'var(--color-gold-muted)' }}
          >
            <path
              d="M10 0L13.09 6.91L20 10L13.09 13.09L10 20L6.91 13.09L0 10L6.91 6.91L10 0Z"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
        </div>

        <span className="pill-header mb-5">A Gust of Playa Dust</span>

        <h1 className="text-optical-h2 mb-4">
          Something blew sideways.
        </h1>

        <p className="text-body-relaxed text-lg mb-8" style={{ color: 'var(--color-ink-soft)' }}>
          An unexpected error interrupted this page. Catch your breath, try again,
          and if the wind keeps howling we&apos;d love to hear from you.
        </p>

        <div className="frame-panel mb-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={reset} className="cta-primary text-sm" type="button">
              <span><RotateCcw className="h-4 w-4" /></span>
              <span>Try Again</span>
            </button>
            <Link href="/" className="cta-secondary text-sm">
              <span><Home className="h-4 w-4" /></span>
              <span>Return Home</span>
            </Link>
          </div>

          {error?.digest ? (
            <p
              className="mt-6 text-xs font-accent tracking-widest"
              style={{ color: 'var(--color-ink-faint)' }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </div>

        <p className="text-sm" style={{ color: 'var(--color-ink-faint)' }}>
          Need a hand?{' '}
          <a
            href={`mailto:${email}`}
            className="text-gold hover:text-gold-dark underline transition-colors"
          >
            {email}
          </a>
        </p>
      </div>
    </main>
  );
}
