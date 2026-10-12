export default function AdminLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-5">
      <div className="max-w-sm w-full text-center">
        {/* Spinner */}
        <div className="mb-6 flex justify-center">
          <svg
            className="animate-spin"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: 'var(--color-gold)' }}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.2"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <p
          className="font-body text-sm font-medium"
          style={{ color: 'var(--color-ink-soft)' }}
        >
          Loading dashboard...
        </p>

        {/* Skeleton cards */}
        <div className="mt-8 space-y-3">
          <div
            className="h-10 rounded-lg animate-pulse"
            style={{ backgroundColor: 'var(--color-cream-warm)' }}
          />
          <div className="grid grid-cols-2 gap-3">
            <div
              className="h-20 rounded-lg animate-pulse"
              style={{ backgroundColor: 'var(--color-cream-warm)' }}
            />
            <div
              className="h-20 rounded-lg animate-pulse"
              style={{ backgroundColor: 'var(--color-cream-warm)' }}
            />
          </div>
          <div
            className="h-32 rounded-lg animate-pulse"
            style={{ backgroundColor: 'var(--color-cream-warm)' }}
          />
        </div>
      </div>
    </div>
  );
}
