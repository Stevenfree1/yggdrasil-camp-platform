'use client';

import { useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { getCampConfig } from '@/lib/config';

const campName = getCampConfig().name;


/** Simple password strength indicator */
function PasswordStrength({ password }: { password: string }) {
  const strength = useMemo(() => {
    if (!password) return { level: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score <= 3) return { level: 3, label: 'Good', color: 'bg-yellow-500' };
    return { level: 4, label: 'Strong', color: 'bg-green-500' };
  }, [password]);

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= strength.level ? strength.color : 'bg-tan/30'
            }`}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: 'var(--color-ink-soft)' }}>{strength.label}</p>
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return false;
    }

    if (password.length > 128) {
      setError('Password must be at most 128 characters.');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/trpc/auth.resetPassword`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ json: { token, newPassword: password } }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(
          data.error?.json?.message || data.error?.message || 'Failed to reset password'
        );
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="luxury-card p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-error/10 rounded-full border border-error/20">
            <AlertCircle className="h-8 w-8 text-error" />
          </div>
        </div>
        <h2 className="font-display text-xl mb-3" style={{ color: 'var(--color-ink)' }}>
          Invalid Link
        </h2>
        <p className="text-body-relaxed text-sm mb-6" style={{ color: 'var(--color-ink-soft)' }}>
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link href="/forgot-password" className="cta-primary inline-flex text-sm">
          <span>Request New Link</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="luxury-card p-8">
      {success ? (
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-success/10 rounded-full border border-success/20">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </div>
          <h2 className="font-display text-xl mb-3" style={{ color: 'var(--color-ink)' }}>
            Password Updated
          </h2>
          <p className="text-body-relaxed text-sm" style={{ color: 'var(--color-ink-soft)' }}>
            Your password has been reset successfully. Redirecting to login...
          </p>
          <div className="mt-4">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" style={{ color: 'var(--color-gold)' }} />
          </div>
        </div>
      ) : (
        <>
          <p className="text-body-relaxed text-sm text-center mb-6" style={{ color: 'var(--color-ink-soft)' }}>
            Enter your new password below. Choose a strong password with at least 8 characters.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-xl" role="alert" aria-live="assertive">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-error mt-0.5 flex-shrink-0" aria-hidden="true" />
                <p className="text-error text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="new-password" className="form-label">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="form-input pr-12"
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  maxLength={128}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-gold transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div>
              <label htmlFor="confirm-password" className="form-label">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="form-input pr-12"
                  placeholder="Confirm your new password"
                  required
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-gold transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-error">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full cta-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <span><Loader2 className="h-5 w-5 mr-2 animate-spin" /></span>
                  <span>Updating...</span>
                </>
              ) : (
                <span>Reset Password</span>
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-cream)' }}>
      <div className="w-full max-w-md animate-fade-in">
        {/* Camp name and tagline */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl tracking-wider mb-2" style={{ color: 'var(--color-ink)' }}>
            {campName.toUpperCase()}
          </h1>
          <p className="font-accent italic text-lg text-sage">
            Reset Password
          </p>
        </div>

        <Suspense
          fallback={
            <div className="luxury-card p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-gold)' }} />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>

        {/* Back to login */}
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-ink-soft hover:text-gold transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
