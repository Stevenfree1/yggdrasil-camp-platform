'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { getCampConfig } from '@/lib/config';

const campName = getCampConfig().name;


export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/trpc/auth.forgotPassword`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ json: { email: email.trim().toLowerCase() } }),
      });

      // Always show success to prevent email enumeration
      if (response.ok || response.status === 404) {
        setSuccess(true);
      } else {
        const data = await response.json();
        throw new Error(data.error?.json?.message || data.error?.message || 'Something went wrong');
      }
    } catch (err) {
      // Still show success message to prevent email enumeration
      // Only show real error if it's a network issue
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Unable to connect to the server. Please try again later.');
      } else {
        setSuccess(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-cream)' }}>
      <div className="w-full max-w-md animate-fade-in">
        {/* Camp name and tagline */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl tracking-wider mb-2" style={{ color: 'var(--color-ink)' }}>
            {campName.toUpperCase()}
          </h1>
          <p className="font-accent italic text-lg" style={{ color: 'var(--color-sage)' }}>
            Password Recovery
          </p>
        </div>

        {/* Card */}
        <div className="luxury-card p-8">
          {success ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-success/10 rounded-full border border-success/20">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
              </div>
              <h2 className="font-accent text-xl tracking-tight mb-3" style={{ color: 'var(--color-ink)' }}>
                Check Your Email
              </h2>
              <p className="text-body-relaxed text-sm mb-6" style={{ color: 'var(--color-ink-soft)' }}>
                If an account exists with that email, we&apos;ve sent a password reset link.
                Please check your inbox and spam folder. The link expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="cta-secondary inline-flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-body-relaxed text-sm text-center mb-6" style={{ color: 'var(--color-ink-soft)' }}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              {displayError && (
                <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-xl" role="alert" aria-live="assertive">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-error mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <p className="text-error text-sm">{displayError}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="reset-email" className="form-label">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="reset-email"
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
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full cta-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <span><Loader2 className="h-5 w-5 mr-2 animate-spin" /></span>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Back to login */}
        {!success && (
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm transition-colors inline-flex items-center gap-1"
              style={{ color: 'var(--color-ink-soft)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
