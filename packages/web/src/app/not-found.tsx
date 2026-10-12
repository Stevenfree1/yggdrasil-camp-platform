import Link from 'next/link';
import { Home, Sparkles, Users, LogIn } from 'lucide-react';
import { getCampConfig } from '@/lib/config';

export default function NotFound() {
  const { email } = getCampConfig();
  const links = [
    { href: '/', icon: Home, label: 'Homepage', description: 'Begin again at the start' },
    { href: '/apply', icon: Sparkles, label: 'Apply', description: 'Join us for the burn' },
    { href: '/members', icon: Users, label: 'Members area', description: 'Dues, shifts, and resources' },
    { href: '/login', icon: LogIn, label: 'Log in', description: 'Back to your portal' },
  ];

  return (
    <main
      className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 py-20 overflow-hidden"
      style={{ backgroundColor: 'var(--color-cream)' }}
    >
      <div className="pattern-geometric absolute inset-0 opacity-40 pointer-events-none" aria-hidden="true" />
      <div className="mountain-silhouette absolute inset-x-0 bottom-0 pointer-events-none" aria-hidden="true" />

      <div className="relative max-w-2xl w-full text-center">
        <p
          className="text-display-thin text-[8rem] sm:text-[10rem] leading-none mb-2"
          style={{ color: 'rgba(74, 93, 90, 0.18)' }}
          aria-hidden="true"
        >
          404
        </p>

        <div className="ornate-divider mb-8" aria-hidden="true">
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

        <span className="pill-header mb-5">Lost on the Playa</span>

        <h1 className="text-optical-h1 mb-5">
          This path has drifted into the dust.
        </h1>

        <p className="text-body-relaxed text-lg mb-3" style={{ color: 'var(--color-ink-soft)' }}>
          The page you&apos;re looking for has wandered off into the whiteout.
        </p>
        <div className="mb-10" />

        <div className="frame-panel mb-10">
          <h2
            className="text-caption mb-5"
            style={{ color: 'var(--color-ink-soft)' }}
          >
            A few good places to land
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {links.map(({ href, icon: Icon, label, description }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-4 border border-tan-300/50 rounded-xl hover:border-gold/70 hover:bg-gold/5 transition-all duration-300 group text-left"
              >
                <Icon className="h-5 w-5 text-ink-soft/50 group-hover:text-gold transition-colors flex-shrink-0" />
                <div>
                  <p className="font-accent text-base text-ink group-hover:text-gold transition-colors">
                    {label}
                  </p>
                  <p className="text-xs text-ink-soft/70 mt-0.5">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link href="/" className="cta-primary text-sm">
            <span><Home className="h-4 w-4" /></span>
            <span>Return Home</span>
          </Link>
        </div>

        <div className="pt-8 border-t border-tan-300/30">
          <p className="text-sm" style={{ color: 'var(--color-ink-faint)' }}>
            Still wandering?{' '}
            <a
              href={`mailto:${email}`}
              className="text-gold hover:text-gold-dark underline transition-colors"
            >
              Send us a note
            </a>{' '}
            and we&apos;ll point you in the right direction.
          </p>
        </div>
      </div>
    </main>
  );
}
