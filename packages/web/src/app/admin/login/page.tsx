'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { getCampConfig } from '@/lib/config';

const campConfig = getCampConfig();

export default function AdminLoginPage() {
  const { login, error, clearError, isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Redirect if already authenticated as admin/manager.
  // Hard navigation on purpose — see the note in /login/page.tsx: a client
  // router.replace can replay a cached middleware redirect and spin forever.
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.role === 'LEAD' || user.role === 'MANAGER') {
        window.location.replace('/admin');
      } else {
        // Regular member -- redirect to portal
        window.location.replace('/portal');
      }
    }
  }, [authLoading, isAuthenticated, user]);

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

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
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
      // Redirect handled by useEffect above
    } catch {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = validationError || error;

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="admin-ledger fixed inset-0 z-[60] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-gold animate-spin" />
      </div>
    );
  }

  // Already authenticated, will redirect
  if (isAuthenticated) {
    return (
      <div className="admin-ledger fixed inset-0 z-[60] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="admin-ledger admin-login-page fixed inset-0 z-[60] overflow-y-auto p-4 sm:p-6">
      <div className="admin-login-shell">
        <section className="admin-login-art">
          <div className="admin-login-seal">
            <span>
              <Image
                src="/images/brand/logo-256.webp"
                alt=""
                width={48}
                height={68}
                className="h-14 w-auto object-contain"
                aria-hidden="true"
              />
            </span>
          </div>

          <div className="admin-login-copy">
            <p className="admin-page-kicker">Operations Ledger</p>
            <h1 className="text-display-thin">
              {campConfig.name}
            </h1>
            <div className="admin-login-rule" aria-hidden="true" />
            <p>
              Private camp operations for membership, dues, applications, communications, and season readiness.
            </p>
          </div>

          <div className="admin-login-footer">
            <span className="h-px w-16 bg-gold/60" />
            <p>
              Season Readiness
            </p>
          </div>
        </section>

        <section className="admin-login-panel">
          <div className="admin-login-mobile-brand lg:hidden">
            <div>
              <Image
                src="/images/brand/logo-256.webp"
                alt=""
                width={48}
                height={68}
                className="h-12 w-auto object-contain"
                aria-hidden="true"
              />
            </div>
            <h1 className="text-display-thin text-3xl text-ink">
              {campConfig.name} Ops
            </h1>
          </div>

          <div className="admin-login-card">
            <div className="admin-login-card-mark" aria-hidden="true">
              <Image
                src="/images/brand/logo-256.webp"
                alt=""
                width={34}
                height={48}
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="admin-login-heading">
              <p className="admin-page-kicker">Secure Console</p>
              <h2 className="text-display-thin">
                Admin Login
              </h2>
              <div className="admin-login-ornament" aria-hidden="true">
                <span />
              </div>
            </div>

            {displayError && (
              <div className="mb-6 rounded-md border border-error/20 bg-error/10 p-4" role="alert" aria-live="assertive">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error" aria-hidden="true" />
                  <p className="text-sm text-error">{displayError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="admin-email" className="form-label">
                  Email Address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Mail className="h-5 w-5 text-ink-soft/50" />
                  </div>
                  <input
                    type="email"
                    id="admin-email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    required
                    disabled={isSubmitting}
                    className="form-input admin-login-input pl-12"
                    placeholder="admin@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-password" className="form-label">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Lock className="h-5 w-5 text-ink-soft/50" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="admin-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    required
                    disabled={isSubmitting}
                    className="form-input admin-login-input pl-12 pr-12"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-ink-soft transition-colors hover:text-gold"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || authLoading}
                className="admin-login-submit cta-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span><Loader2 className="mr-2 h-5 w-5 animate-spin" /></span>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span><ArrowRight className="h-5 w-5" /></span>
                  </>
                )}
              </button>
            </form>

            <Link href="/forgot-password" className="admin-login-forgot">
              Forgot password?
            </Link>
          </div>

          <div className="admin-login-links">
            <p>
              Not an admin?{' '}
              <Link href="/">
                Go to homepage
              </Link>
            </p>
            <p className="admin-login-security">
              <Lock className="h-3.5 w-3.5" />
              Secured with SSL encryption
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
