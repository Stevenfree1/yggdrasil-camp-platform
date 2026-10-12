'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCampConfig } from '@/lib/config';

const campName = getCampConfig().name;

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const { login, error, clearError, isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Redirect if already authenticated.
  //
  // Deliberately a HARD navigation, not router.replace: the logged-out visit
  // to the target page left a middleware redirect (→ /login) in Next's client
  // router cache, and a client-side navigation replays that cached redirect —
  // bouncing straight back here in an endless spinner loop until a full
  // reload. A document navigation re-runs middleware with the fresh session
  // cookie (and picks up newly deployed client code, as a bonus).
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') &&
          !redirectTo.startsWith('/login') && !redirectTo.startsWith('/admin/login')) {
        window.location.replace(redirectTo);
      } else if (user.role === 'LEAD' || user.role === 'MANAGER') {
        window.location.replace('/admin');
      } else {
        window.location.replace('/portal');
      }
    }
  }, [authLoading, isAuthenticated, user, redirectTo]);

  const validateForm = (): boolean => {
    setValidationError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setValidationError('Email address is required.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setValidationError('Please enter a valid email address.');
      return false;
    }

    if (!password) {
      setValidationError('Password is required.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await login(email.trim().toLowerCase(), password);
      // Redirect handled by useEffect above after user state updates
    } catch {
      // Error is handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = validationError || error;

  // Don't render form if already authenticated (will redirect)
  if (!authLoading && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-cream)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-gold)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ backgroundColor: 'var(--color-cream)' }}>
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, var(--color-ink) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Camp name and tagline */}
        <div className="text-center mb-8">
          <Link
            href="/"
            aria-label={`${campName} home`}
            className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full transition-opacity duration-200 hover:opacity-85"
            style={{
              backgroundColor: 'rgba(var(--color-gold-rgb), 0.08)',
              border: '1px solid rgba(var(--color-gold-rgb), 0.25)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            <Image
              src="/images/brand/logo-256.webp"
              alt={campName}
              width={54}
              height={78}
              className="h-[68px] w-auto object-contain"
              priority
            />
          </Link>
          <h1 className="font-display text-3xl tracking-wider mb-2" style={{ color: 'var(--color-ink)' }}>
            {campName.toUpperCase()}
          </h1>
          <p className="font-accent italic text-lg text-sage">
            Member Portal
          </p>
        </div>

        {/* Login card */}
        <div className="luxury-card p-8">
          {/* Error message */}
          <AnimatedError error={displayError} />

          {/* Redirect notice */}
          {redirectTo && !displayError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-4 rounded-xl"
              style={{ backgroundColor: 'rgba(var(--color-gold-rgb), 0.08)', border: '1px solid rgba(var(--color-gold-rgb), 0.2)' }}
            >
              <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>Please sign in to continue.</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="form-label">
                Email Address
              </label>
              <input
                type="email"
                id="login-email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                className="form-input"
                placeholder="your@email.com"
                required
                autoComplete="email"
                disabled={isSubmitting}
                aria-describedby={displayError ? 'login-error' : undefined}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="form-label mb-0">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium transition-colors"
                  style={{ color: 'var(--color-sage)' }}
                  tabIndex={-1}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  className="form-input pr-12"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors"
                  style={{ color: 'var(--color-ink-soft)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isSubmitting || authLoading}
              whileHover={{ scale: isSubmitting ? 1 : 1.01 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className="w-full cta-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid rgba(var(--color-line-rgb), 0.3)' }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-faint)' }}>
                Not a member yet?
              </span>
            </div>
          </div>

          {/* Apply link */}
          <Link
            href="/apply"
            className="w-full cta-secondary flex items-center justify-center gap-2 text-sm"
          >
            <span>Apply for Membership</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Back to home */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-ink-soft hover:text-gold transition-colors"
          >
            Back to homepage
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

function AnimatedError({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-4 rounded-xl"
      role="alert"
      aria-live="assertive"
      style={{ backgroundColor: 'rgba(var(--color-error-rgb, 220, 38, 38), 0.06)', border: '1px solid rgba(var(--color-error-rgb, 220, 38, 38), 0.15)' }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-error)' }} aria-hidden="true" />
        <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-cream)' }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-gold)' }} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
