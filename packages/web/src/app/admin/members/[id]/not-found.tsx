import Link from 'next/link';

export default function MemberNotFound() {
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
              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
            />
          </svg>
        </div>
        <h2
          className="font-display text-xl mb-2"
          style={{ color: 'var(--color-ink)' }}
        >
          Member Not Found
        </h2>
        <p
          className="font-body text-sm mb-6 leading-relaxed"
          style={{ color: 'var(--color-ink-soft)' }}
        >
          The member you are looking for does not exist or may have been removed.
          Please check the ID and try again.
        </p>
        <Link
          href="/admin/members"
          className="cta-primary"
        >
          <span>Back to Members</span>
        </Link>
      </div>
    </div>
  );
}
