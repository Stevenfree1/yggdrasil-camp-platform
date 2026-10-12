'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useContentConfig } from '../../hooks/useConfig';
import { getIcon } from '../../lib/icons';
import { useAuth } from '../../contexts/AuthContext';
import { Reveal } from '../../components/reveal';

/**
 * /members — landing for signed-out members: a short "what's in here" intro
 * plus the login form. Signed-in users are sent straight to /portal.
 */
export default function MembersPage() {
  const { members } = useContentConfig();
  const { user, isAuthenticated, isLoading: authLoading, error, login, clearError } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect authenticated users to the portal dashboard.
  // Hard navigation on purpose — see the note in /login/page.tsx: a client
  // router.replace can replay a cached middleware redirect and spin forever.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      window.location.replace('/portal');
    }
  }, [authLoading, isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      await login(formData.email, formData.password);
    } catch {
      // Error is surfaced by the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (isAuthenticated && user) {
    return null; // useEffect above handles the redirect to /portal
  }

  const { loginSection } = members;

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--color-cream)' }}>
      <section className="pt-24 pb-20 md:pt-32">
        <div className="section-contained grid grid-cols-1 gap-14 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          {/* Intro */}
          <div>
            <Reveal direction="up">
              <p className="text-eyebrow mb-4">{members.eyebrow}</p>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl mb-6" style={{ color: 'var(--color-ink)' }}>
                {members.title}
              </h1>
              <p className="font-accent text-lg md:text-xl max-w-xl leading-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
                {members.description}
              </p>
            </Reveal>

            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
              {members.highlights.map((item, i) => {
                const Icon = getIcon(item.icon);
                return (
                  <Reveal key={item.title} direction="up" delay={i * 0.06}>
                    <Icon className="h-6 w-6 mb-3" style={{ color: 'var(--color-gold)' }} aria-hidden="true" />
                    <h2 className="font-display text-lg mb-1" style={{ color: 'var(--color-ink)' }}>
                      {item.title}
                    </h2>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-ink-soft)' }}>
                      {item.description}
                    </p>
                  </Reveal>
                );
              })}
            </div>
          </div>

          {/* Login */}
          <Reveal direction="up" delay={0.1}>
            <div className="luxury-card p-8">
              <h2 className="font-display text-2xl text-center mb-2" style={{ color: 'var(--color-ink)' }}>
                {loginSection.title}
              </h2>
              <p className="text-body-relaxed text-sm text-center mb-6" style={{ color: 'var(--color-ink-soft)' }}>
                {loginSection.subtitle}
              </p>

              {error && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl" role="alert" aria-live="assertive">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" aria-hidden="true" />
                    <p className="text-amber-800 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label htmlFor="login-email" className="form-label">
                    {loginSection.emailLabel}
                  </label>
                  <input
                    type="email"
                    id="login-email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="login-password" className="form-label mb-0">
                      {loginSection.passwordLabel}
                    </label>
                    <Link href="/forgot-password" className="text-sm text-gold hover:text-gold/80 transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="login-password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="form-input pr-12"
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-gold transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || authLoading}
                  className="w-full cta-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{isSubmitting ? 'Signing in...' : loginSection.submitButton}</span>
                </button>
              </form>

              <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-ink-soft)' }}>
                {loginSection.notMemberText}{' '}
                <Link href="/apply" className="text-gold font-medium hover:text-gold/80 transition-colors">
                  {loginSection.applyLinkText}
                </Link>
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
