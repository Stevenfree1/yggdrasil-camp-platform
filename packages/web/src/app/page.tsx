import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Wind } from 'lucide-react';
import { Reveal } from '../components/reveal';
import { getCampConfig, getContentConfig } from '../lib/config';
import { getIcon } from '../lib/icons';
import type { CtaLink } from '../../../../config/types';

/**
 * Public landing page. Every string and image comes from
 * config/content.config.ts so a new camp only edits config.
 */

function PrimaryCta({ cta, onDark = false }: { cta: CtaLink; onDark?: boolean }) {
  const Icon = cta.icon ? getIcon(cta.icon) : ArrowRight;
  return (
    <Link
      href={cta.link}
      className={`cta-primary ${onDark ? 'cta-sun' : ''}`}
    >
      <span>{cta.text}</span>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function SecondaryCta({ cta, onDark = false }: { cta: CtaLink; onDark?: boolean }) {
  return (
    <Link
      href={cta.link}
      className={
        onDark
          ? 'cta-secondary cta-on-dark'
          : 'cta-secondary'
      }
    >
      <span>{cta.text}</span>
    </Link>
  );
}

export default function HomePage() {
  const camp = getCampConfig();
  const { hero, home } = getContentConfig();

  return (
    <main className="camp-home" style={{ backgroundColor: 'var(--color-cream)' }}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="camp-hero">
        <div className="camp-hero-copy">
          <Reveal direction="up">
            <p className="camp-hero-eyebrow">{hero.eyebrow}</p>
            <h1 className="camp-hero-title">
              {hero.titleLines ? (
                <><span className="camp-title-prefix">{hero.titleLines[0]}</span>{' '}{hero.titleLines[1]}</>
              ) : hero.title}
            </h1>
            <p className="camp-hero-tagline">{hero.subtitle}</p>
            <p className="camp-hero-description">{hero.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryCta cta={hero.cta.primary} onDark />
              <SecondaryCta cta={hero.cta.secondary} onDark />
            </div>
          </Reveal>
        </div>
        <div className="camp-hero-photo">
          <Image
            src={hero.image.src}
            alt={hero.image.alt}
            fill
            priority
            sizes="(min-width: 900px) 48vw, 100vw"
            className="object-cover"
          />
          <div className="camp-wind-stamp" aria-hidden="true">
            <Wind strokeWidth={1.6} />
          </div>
          <p className="camp-photo-caption">{camp.location}</p>
        </div>
      </section>

      <div className="camp-field-notes">
        {home.fieldNotes.map((note) => (
          <span key={note}><span aria-hidden="true">✳</span>{note}</span>
        ))}
      </div>

      {/* ── What we do ───────────────────────────────────────── */}
      <section className="section-base">
        <div className="section-contained">
          <Reveal direction="up" className="max-w-2xl">
            <p className="text-eyebrow mb-4">{home.about.eyebrow}</p>
            <h2 className="font-display text-3xl md:text-5xl" style={{ color: 'var(--color-ink)' }}>
              {home.about.title}
            </h2>
            <p className="text-body-relaxed mt-5 text-lg" style={{ color: 'var(--color-ink-soft)' }}>
              {home.about.description}
            </p>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {home.about.cards.map((card, i) => {
              const Icon = getIcon(card.icon);
              return (
                <Reveal key={card.title} direction="up" delay={i * 0.1}>
                  <article className="camp-story-card group h-full overflow-hidden border bg-[var(--color-surface)]" style={{ borderColor: 'var(--color-warm-border)' }}>
                    <div className="image-frame relative aspect-[4/3] rounded-none">
                      <Image
                        src={card.image.src}
                        alt={card.image.alt}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="p-6">
                      <div className="mb-3 flex items-center gap-3">
                        <Icon className="h-5 w-5" style={{ color: 'var(--color-gold)' }} aria-hidden="true" />
                        <h3 className="font-display text-3xl uppercase" style={{ color: 'var(--color-ink)' }}>
                          {card.title}
                        </h3>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
                        {card.description}
                      </p>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How joining works ────────────────────────────────── */}
      <section className="camp-joining section-alt">
        <div className="section-contained">
          <Reveal direction="up" className="max-w-2xl">
            <p className="text-eyebrow mb-4">{home.joining.eyebrow}</p>
            <h2 className="font-display text-3xl md:text-5xl" style={{ color: 'var(--color-ink)' }}>
              {home.joining.title}
            </h2>
            <p className="text-body-relaxed mt-5 text-lg" style={{ color: 'var(--color-ink-soft)' }}>
              {home.joining.description}
            </p>
          </Reveal>

          <ol className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {home.joining.steps.map((step, i) => {
              const Icon = getIcon(step.icon);
              return (
                <li key={step.title}>
                  <Reveal direction="up" delay={i * 0.08} className="h-full">
                    <div className="camp-step h-full">
                      <div className="mb-5 flex items-center justify-between">
                        <span
                          className="font-display text-5xl"
                          style={{ color: 'var(--color-gold)' }}
                          aria-hidden="true"
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <Icon className="h-5 w-5" style={{ color: 'var(--color-ink-faint)' }} aria-hidden="true" />
                      </div>
                      <h3 className="font-display text-2xl uppercase mb-2" style={{ color: 'var(--color-ink)' }}>
                        <span className="sr-only">Step {i + 1}: </span>
                        {step.title}
                      </h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
                        {step.description}
                      </p>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden py-28 md:py-36">
        <Image
          src={home.closing.image.src}
          alt={home.closing.image.alt}
          fill
          sizes="100vw"
          className="-z-20 object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{ background: 'linear-gradient(90deg, rgba(20,14,10,0.85) 0%, rgba(20,14,10,0.55) 100%)' }}
          aria-hidden="true"
        />
        <div className="section-contained">
          <Reveal direction="up" className="max-w-2xl">
            <h2 className="font-display text-3xl text-white md:text-5xl">{home.closing.title}</h2>
            <p className="mt-5 text-lg leading-relaxed text-white/80">{home.closing.description}</p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <PrimaryCta cta={home.closing.cta.primary} onDark />
              {home.closing.cta.secondary && <SecondaryCta cta={home.closing.cta.secondary} onDark />}
            </div>
            <p className="mt-8 text-sm text-white/60">
              Questions?{' '}
              <a href={`mailto:${camp.email}`} className="underline underline-offset-4 hover:text-white">
                {camp.email}
              </a>
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
