export default function Loading() {
  return (
    <main
      className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-20 overflow-hidden"
      style={{ backgroundColor: 'var(--color-cream)' }}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="pattern-geometric absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true" />
      <div className="mountain-silhouette absolute inset-x-0 bottom-0 pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-md w-full text-center">
        <div className="ornate-divider mb-8 animate-pulse" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ color: 'var(--color-gold)' }}
          >
            <path
              d="M10 0L13.09 6.91L20 10L13.09 13.09L10 20L6.91 13.09L0 10L6.91 6.91L10 0Z"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
        </div>

        <span className="pill-header mb-6">Tending the Fire</span>

        <h1 className="text-optical-h2 mb-6">
          Gathering the camp&hellip;
        </h1>

        {/* Sage shimmer skeleton lines */}
        <div className="space-y-3 max-w-sm mx-auto mb-8" aria-hidden="true">
          <div
            className="h-2.5 rounded-full animate-pulse"
            style={{
              backgroundColor: 'rgba(74, 93, 90, 0.18)',
              animationDelay: '0ms',
            }}
          />
          <div
            className="h-2.5 rounded-full animate-pulse w-5/6 mx-auto"
            style={{
              backgroundColor: 'rgba(74, 93, 90, 0.14)',
              animationDelay: '150ms',
            }}
          />
          <div
            className="h-2.5 rounded-full animate-pulse w-2/3 mx-auto"
            style={{
              backgroundColor: 'rgba(74, 93, 90, 0.10)',
              animationDelay: '300ms',
            }}
          />
        </div>

        <p
          className="text-sm font-accent italic tracking-wide"
          style={{ color: 'var(--color-ink-faint)' }}
        >
          A breath of dust, a flicker of gold.
        </p>
      </div>
    </main>
  );
}
