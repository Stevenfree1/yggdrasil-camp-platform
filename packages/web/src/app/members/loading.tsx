export default function MembersLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-5">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <p
            className="font-body text-sm"
            style={{ color: 'var(--color-ink-faint)' }}
          >
            Loading...
          </p>
        </div>

        {/* List skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-warm-border)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: 'var(--color-cream-warm)' }}
                />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-4 w-28 rounded"
                    style={{ backgroundColor: 'var(--color-cream-warm)' }}
                  />
                  <div
                    className="h-3 w-40 rounded"
                    style={{ backgroundColor: 'var(--color-cream-warm)' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
