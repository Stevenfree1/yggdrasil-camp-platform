export default function PortalLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-5">
      <div className="max-w-lg w-full">
        {/* Header skeleton */}
        <div className="text-center mb-10">
          <div
            className="h-5 w-40 mx-auto rounded animate-pulse mb-3"
            style={{ backgroundColor: 'var(--color-cream-warm)' }}
          />
          <p
            className="font-body text-sm"
            style={{ color: 'var(--color-ink-faint)' }}
          >
            Loading your portal...
          </p>
        </div>

        {/* Content skeleton */}
        <div className="space-y-4">
          {/* Profile card skeleton */}
          <div
            className="rounded-xl p-6 animate-pulse"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-warm-border)',
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full"
                style={{ backgroundColor: 'var(--color-cream-warm)' }}
              />
              <div className="flex-1 space-y-2">
                <div
                  className="h-4 w-32 rounded"
                  style={{ backgroundColor: 'var(--color-cream-warm)' }}
                />
                <div
                  className="h-3 w-48 rounded"
                  style={{ backgroundColor: 'var(--color-cream-warm)' }}
                />
              </div>
            </div>
          </div>

          {/* Navigation skeleton */}
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl animate-pulse"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-warm-border)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
