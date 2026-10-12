import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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
      className="cta-primary shadow-lg"
      style={onDark ? { backgroundColor: '#FAF7F0', color: '#2A1F1A', borderColor: '#FAF7F0' } : undefined}
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
          ? 'cta-secondary border-white/50 text-white bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:text-white'
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
    <main style={{ backgroundColor: 'var(--color-cream)' }}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[92vh] items-end overflow-hidden pt-28">
        <Image
          src={hero.image.src}
          alt={hero.image.alt}
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(180deg, rgba(20,14,10,0.25) 0%, rgba(20,14,10,0.35) 45%, rgba(20,14,10,0.82) 100%)',
          }}
          aria-hidden="true"
        />

        <div className="section-contained w-full pb-16 md:pb-24">
          <Reveal direction="up" className="max-w-3xl">
            <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.3em] text-white/75">
              {hero.eyebrow}
            </p>
            <h1 className="font-display text-5xl leading-[0.95] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)] sm:text-6xl md:text-7xl lg:text-8xl">
              {hero.title}
            </h1>
            <p className="mt-6 font-accent text-xl italic text-white/90 md:text-2xl">{hero.subtitle}</p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">
              {hero.description}
            </p>
          </Reveal>

          <Reveal direction="up" delay={0.15} className="mt-10 flex flex-col gap-4 sm:flex-row">
            <PrimaryCta cta={hero.cta.primary} onDark />
            <SecondaryCta cta={hero.cta.secondary} onDark />
          </Reveal>
        </div>
      </section>

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
                  <article className="group h-full overflow-hidden rounded-lg border bg-[var(--color-surface)]" style={{ borderColor: 'var(--color-warm-border)' }}>
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
                        <h3 className="font-display text-xl" style={{ color: 'var(--color-ink)' }}>
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
      <section className="section-alt">
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
                    <div className="luxury-card h-full !p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <span
                          className="font-display text-3xl"
                          style={{ color: 'var(--color-gold)' }}
                          aria-hidden="true"
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <Icon className="h-5 w-5" style={{ color: 'var(--color-ink-faint)' }} aria-hidden="true" />
                      </div>
                      <h3 className="font-display text-xl mb-2" style={{ color: 'var(--color-ink)' }}>
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
