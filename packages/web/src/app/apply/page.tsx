'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Reveal } from '../../components/reveal';
import { useCampConfig, useContentConfig } from '../../hooks/useConfig';

type Experience = 'FIRST_TIMER' | 'BEEN_BEFORE' | 'VETERAN';

/** Mirror the camp's import logic: derive the experience enum from the two
 *  yes/no questions on the interest form. */
function deriveExperience(firstTime: boolean | null, returning: boolean | null): Experience {
  if (firstTime === true) return 'FIRST_TIMER';
  if (returning === true) return 'VETERAN';
  return 'BEEN_BEFORE';
}

interface FormState {
  name: string;
  playaName: string;
  email: string;
  phone: string;
  isBurningManFirstTime: boolean | null;
  isCampReturning: boolean | null;
  referredBy: string;
  motivationText: string;
  hasTicket: boolean | null;
  groupMembersText: string;
  housingPreference: string;
  contribution: string;
  canStrike: boolean | null;
}

const INITIAL: FormState = {
  name: '', playaName: '', email: '', phone: '',
  isBurningManFirstTime: null, isCampReturning: null,
  referredBy: '', motivationText: '', hasTicket: null,
  groupMembersText: '', housingPreference: '', contribution: '', canStrike: null,
};

/** Yes/No gold pill control with optional custom labels (e.g. "Yes, first burn"). */
function YesNo({
  value, onChange, disabled, yesLabel = 'Yes', noLabel = 'No',
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div className="inline-flex flex-wrap gap-3">
      {[{ v: true, l: yesLabel }, { v: false, l: noLabel }].map(({ v, l }) => {
        const active = value === v;
        return (
          <button
            key={l}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className="px-6 py-2.5 text-sm font-medium rounded-full border transition-all duration-200 hover:shadow-[0_0_14px_rgba(185,148,67,0.45)] disabled:opacity-50 disabled:hover:shadow-none"
            style={{
              borderColor: active ? 'var(--color-gold)' : 'var(--color-warm-border)',
              backgroundColor: active ? 'var(--color-gold)' : 'transparent',
              color: active ? 'var(--color-ink)' : 'var(--color-ink-soft)',
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

/** A labeled, scroll-revealed form section with a hairline divider. */
function Section({ title, children, first = false }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <Reveal direction="up" className={first ? '' : 'mt-9 pt-9 border-t border-warm-border'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-6" style={{ color: 'var(--color-gold-muted)' }}>
        {title}
      </p>
      <div className="space-y-7">{children}</div>
    </Reveal>
  );
}

const REQUIRED = <span className="text-error">*</span>;

export default function ApplyPage() {
  const camp = useCampConfig();
  const { apply } = useContentConfig();
  const memberNoun = camp.memberNoun.singular;
  const [form, setForm] = useState<FormState>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error) setError(null);
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Please enter your first and last name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
    if (!form.phone.trim()) return 'Please enter a phone number (with country code).';
    if (form.isBurningManFirstTime === null) return 'Please let us know if it’s your first time at Burning Man.';
    if (form.isCampReturning === null) return `Please let us know if you’re a returning ${memberNoun}.`;
    if (!form.referredBy.trim()) return 'Please tell us who referred you to the camp.';
    if (!form.motivationText.trim()) return `Please tell us why you want to join ${camp.name}.`;
    if (!form.contribution.trim()) return 'Please tell us how you’ve contributed or plan to get involved.';
    if (form.hasTicket === null) return 'Please let us know if you have a ticket.';
    if (!form.housingPreference.trim()) return 'Please tell us what type of accommodation you plan to use.';
    if (form.canStrike === null) return 'Please let us know if you can be there for Strike.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    setError(null);
    setIsSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      experience: deriveExperience(form.isBurningManFirstTime, form.isCampReturning),
      isBurningManFirstTime: form.isBurningManFirstTime,
      isCampReturning: form.isCampReturning,
      hasTicket: form.hasTicket,
      strikeCommitment: form.canStrike,
      referredBy: form.referredBy.trim(),
      motivationText: form.motivationText.trim(),
      housingPreference: form.housingPreference.trim(),
      contribution: form.contribution.trim(),
    };
    if (form.playaName.trim()) payload.playaName = form.playaName.trim();
    if (form.groupMembersText.trim()) payload.groupMembersText = form.groupMembersText.trim();

    try {
      const res = await fetch('/api/trpc/applications.submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: payload }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(
          data.error?.json?.message || data.error?.message || 'Something went wrong submitting your application.'
        );
      }
      setSuccess(true);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ backgroundColor: 'var(--color-cream)' }}>
      <section className="py-24 md:py-32">
        <div className="max-w-2xl mx-auto px-5 md:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <p className="text-eyebrow mb-4">{apply.eyebrow}</p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tight mb-5" style={{ color: 'var(--color-ink)' }}>
              {apply.title}
            </h1>
            <p className="font-accent text-base md:text-lg leading-relaxed max-w-xl mx-auto" style={{ color: 'var(--color-ink-soft)' }}>
              {apply.intro}
            </p>
          </div>

          {success ? (
            <div className="luxury-card p-8 md:p-10 text-center">
              <div className="flex justify-center mb-5">
                <div className="p-3 bg-success/10 rounded-full border border-success/20">
                  <CheckCircle className="h-9 w-9 text-success" />
                </div>
              </div>
              <h2 className="font-display text-2xl mb-3" style={{ color: 'var(--color-ink)' }}>
                {apply.success.title}
              </h2>
              <p className="text-body-relaxed text-sm md:text-base mb-6" style={{ color: 'var(--color-ink-soft)' }}>
                {apply.success.message}
              </p>
              <Link href="/" className="cta-secondary inline-flex text-sm">
                <span>Back to home</span>
              </Link>
            </div>
          ) : (
            <>
              {/* What membership involves */}
              <div className="luxury-card p-6 md:p-7 mb-7">
                <h2 className="form-label !mb-3" style={{ color: 'var(--color-ink)' }}>{apply.requirements.title}</h2>
                <ul className="space-y-2 text-sm leading-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
                  {apply.requirements.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <p className="text-xs mt-4 leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
                  {apply.requirements.note}
                </p>
              </div>

              <div className="luxury-card p-8 md:p-10">
                {error && (
                  <div className="mb-7 p-4 bg-error/10 border border-error/20 rounded-xl" role="alert" aria-live="assertive">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-error mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <p className="text-error text-sm">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="apply-form" noValidate>
                  {/* ── Contact ── */}
                  <Section title="Contact" first>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="name" className="form-label">What is your first and last name? {REQUIRED}</label>
                        <input id="name" type="text" className="form-input" value={form.name}
                          onChange={(e) => set('name', e.target.value)} required maxLength={100}
                          autoComplete="name" disabled={isSubmitting} />
                      </div>
                      <div>
                        <label htmlFor="playaName" className="form-label">Playa name</label>
                        <input id="playaName" type="text" className="form-input" value={form.playaName}
                          onChange={(e) => set('playaName', e.target.value)} maxLength={100}
                          placeholder="If you have one" disabled={isSubmitting} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="email" className="form-label">Email {REQUIRED}</label>
                        <input id="email" type="email" className="form-input" value={form.email}
                          onChange={(e) => set('email', e.target.value)} required maxLength={255}
                          autoComplete="email" placeholder="your@email.com" disabled={isSubmitting} />
                      </div>
                      <div>
                        <label htmlFor="phone" className="form-label">Phone number {REQUIRED}</label>
                        <input id="phone" type="tel" className="form-input" value={form.phone}
                          onChange={(e) => set('phone', e.target.value)} required maxLength={20}
                          autoComplete="tel" placeholder="Please include country code" disabled={isSubmitting} />
                      </div>
                    </div>
                  </Section>

                  {/* ── About you ── */}
                  <Section title="About you">
                    <div>
                      <span className="form-label">Is it your first time at Burning Man? {REQUIRED}</span>
                      <div className="mt-1">
                        <YesNo value={form.isBurningManFirstTime} onChange={(v) => set('isBurningManFirstTime', v)}
                          disabled={isSubmitting} yesLabel={apply.firstTimerYesLabel} noLabel="No" />
                      </div>
                    </div>

                    <div>
                      <span className="form-label">Have you camped with {camp.name} before? {REQUIRED}</span>
                      <div className="mt-1">
                        <YesNo value={form.isCampReturning} onChange={(v) => set('isCampReturning', v)} disabled={isSubmitting} />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="referredBy" className="form-label">Who referred you to the camp? {REQUIRED}</label>
                      <input id="referredBy" type="text" className="form-input" value={form.referredBy}
                        onChange={(e) => set('referredBy', e.target.value)} required maxLength={200}
                        disabled={isSubmitting} />
                    </div>

                    <div>
                      <label htmlFor="motivation" className="form-label">Why do you want to join {camp.name}? {REQUIRED}</label>
                      <textarea id="motivation" className="form-input min-h-[120px] resize-y" value={form.motivationText}
                        onChange={(e) => set('motivationText', e.target.value)} required maxLength={5000}
                        disabled={isSubmitting} />
                    </div>

                    <div>
                      <label htmlFor="contribution" className="form-label">
                        How would you contribute? {REQUIRED}
                      </label>
                      <div className="text-sm mb-2 leading-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
                        <p>{apply.contributionPrompt}</p>
                      </div>
                      <textarea id="contribution" className="form-input min-h-[120px] resize-y" value={form.contribution}
                        onChange={(e) => set('contribution', e.target.value)} required maxLength={2000}
                        placeholder={apply.contributionPlaceholder}
                        disabled={isSubmitting} />
                    </div>
                  </Section>

                  {/* ── Logistics ── */}
                  <Section title="Logistics">
                    <div>
                      <span className="form-label">Do you have a ticket? {REQUIRED}</span>
                      <div className="mt-1">
                        <YesNo value={form.hasTicket} onChange={(v) => set('hasTicket', v)} disabled={isSubmitting} />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="group" className="form-label">
                        If you’re coming in a group, please list all group members below.
                      </label>
                      <textarea id="group" className="form-input min-h-[72px] resize-y" value={form.groupMembersText}
                        onChange={(e) => set('groupMembersText', e.target.value)} maxLength={2000}
                        placeholder="Please note, every member must fill out a form."
                        disabled={isSubmitting} />
                    </div>

                    <div>
                      <label htmlFor="housing" className="form-label">
                        What type of accommodation do you plan to use for the week, and who will you be sharing it with?
                        (ie: tent, RV, shiftpod) {REQUIRED}
                      </label>
                      <textarea id="housing" className="form-input min-h-[72px] resize-y" value={form.housingPreference}
                        onChange={(e) => set('housingPreference', e.target.value)} required maxLength={500}
                        placeholder="Sharing accommodations is preferred to maintain space."
                        disabled={isSubmitting} />
                    </div>
                  </Section>

                  {/* ── Commitment ── */}
                  <Section title="Commitment">
                    <div>
                      <span className="form-label">Strike is mandatory and every member is required to be present. {REQUIRED}</span>
                      <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
                        {apply.strikeNote}
                      </p>
                      <span className="block text-sm mb-1" style={{ color: 'var(--color-ink-soft)' }}>Can you be there for Strike?</span>
                      <YesNo value={form.canStrike} onChange={(v) => set('canStrike', v)} disabled={isSubmitting} />
                    </div>
                  </Section>

                  <Reveal direction="up" className="mt-9">
                    <button type="submit" disabled={isSubmitting}
                      className="w-full cta-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                      {isSubmitting ? (
                        <><span><Loader2 className="h-5 w-5 mr-2 animate-spin" /></span><span>Submitting...</span></>
                      ) : (
                        <span>Submit</span>
                      )}
                    </button>

                    <p className="text-xs text-center mt-4" style={{ color: 'var(--color-ink-soft)' }}>
                      Already a member?{' '}
                      <Link href="/login" className="underline" style={{ color: 'var(--color-sage)' }}>Log in</Link>
                    </p>
                  </Reveal>
                </form>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
