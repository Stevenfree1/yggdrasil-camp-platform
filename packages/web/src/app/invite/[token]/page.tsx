'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, Eye, EyeOff, PartyPopper, XCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
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

type InviteState =
  | { status: 'loading' }
  | { status: 'valid'; email: string; name: string }
  | { status: 'invalid'; message: string }
  | { status: 'already_accepted' };

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const inviteToken = params.token as string;
  const { register } = useAuth();

  const [inviteState, setInviteState] = useState<InviteState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate the invite token on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/trpc/auth.validateInvite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ json: { inviteToken } }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          const message = data.error?.json?.message || data.error?.message || 'Invalid invite link';
          if (message.toLowerCase().includes('already been accepted')) {
            setInviteState({ status: 'already_accepted' });
          } else {
            setInviteState({ status: 'invalid', message });
          }
          return;
        }

        const result = data.result?.data?.json;
        if (result?.valid) {
          setInviteState({
            status: 'valid',
            email: result.email,
            name: result.name,
          });
        } else {
          setInviteState({ status: 'invalid', message: 'Invalid invite link.' });
        }
      } catch {
        setInviteState({
          status: 'invalid',
          message: 'Unable to validate invite. Please try again later.',
        });
      }
    };

    if (inviteToken) {
      validateToken();
    } else {
      setInviteState({ status: 'invalid', message: 'No invite token provided.' });
    }
  }, [inviteToken]);

  const validateForm = (): boolean => {
    setError(null);

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

    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await register(inviteToken, password);
      // register in AuthContext auto-logs in, redirect to portal
      router.push('/portal');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while validating token
  if (inviteState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-cream)' }}>
        <div className="w-full max-w-md text-center">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl tracking-wider mb-2" style={{ color: 'var(--color-ink)' }}>
              {campName.toUpperCase()}
            </h1>
            <p className="font-accent italic text-lg text-sage">
              Welcome Aboard
            </p>
          </div>
          <div className="luxury-card p-8 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: 'var(--color-gold)' }} />
            <p className="text-body-relaxed text-sm" style={{ color: 'var(--color-ink-soft)' }}>Validating your invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid token
  if (inviteState.status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-cream)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl tracking-wider mb-2" style={{ color: 'var(--color-ink)' }}>
              {campName.toUpperCase()}
            </h1>
          </div>
          <div className="luxury-card p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-error/10 rounded-full border border-error/20">
                <XCircle className="h-8 w-8 text-error" />
              </div>
            </div>
            <h2 className="font-display text-xl mb-3" style={{ color: 'var(--color-ink)' }}>
              Invalid Invitation
            </h2>
            <p className="text-body-relaxed text-sm mb-6" style={{ color: 'var(--color-ink-soft)' }}>
              {inviteState.message}
            </p>
            <Link href="/login" className="cta-secondary inline-flex items-center gap-2 text-sm">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Already accepted
  if (inviteState.status === 'already_accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-cream)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl tracking-wider mb-2" style={{ color: 'var(--color-ink)' }}>
              {campName.toUpperCase()}
            </h1>
          </div>
          <div className="luxury-card p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gold/10 rounded-full border border-gold/30">
                <PartyPopper className="h-8 w-8" style={{ color: 'var(--color-gold)' }} />
              </div>
            </div>
            <h2 className="font-display text-xl mb-3" style={{ color: 'var(--color-ink)' }}>
              Already Accepted
            </h2>
            <p className="text-body-relaxed text-sm mb-6" style={{ color: 'var(--color-ink-soft)' }}>
              This invitation has already been accepted. You can sign in with your existing credentials.
            </p>
            <Link href="/login" className="cta-primary inline-flex text-sm">
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Valid token -- show registration form
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-cream)' }}>
      <div className="w-full max-w-md animate-fade-in">
        {/* Camp name */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl tracking-wider mb-2" style={{ color: 'var(--color-ink)' }}>
            {campName.toUpperCase()}
          </h1>
          <p className="font-accent italic text-lg text-sage">
            Welcome Aboard
          </p>
        </div>

        {/* Invite card */}
        <div className="luxury-card p-8">
          {/* Welcome icon */}
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gold/10 rounded-full border border-gold/30">
              <PartyPopper className="h-8 w-8" style={{ color: 'var(--color-gold)' }} />
            </div>
          </div>

          <h2 className="font-display text-xl text-center mb-2" style={{ color: 'var(--color-ink)' }}>
            You&apos;ve Been Invited
          </h2>
          <p className="text-body-relaxed text-sm text-center mb-2" style={{ color: 'var(--color-ink-soft)' }}>
            Welcome to {campName}, <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>{inviteState.name}</span>!
          </p>
          <p className="text-body-relaxed text-sm text-center mb-6" style={{ color: 'var(--color-ink-soft)' }}>
            Set your password below to activate your account for{' '}
            <span className="font-medium" style={{ color: 'var(--color-ink)' }}>{inviteState.email}</span>.
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
              <label htmlFor="invite-password" className="form-label">
                Create Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="invite-password"
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
              <label htmlFor="invite-confirm-password" className="form-label">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="invite-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="form-input pr-12"
                  placeholder="Confirm your password"
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
              disabled={isSubmitting || (!!confirmPassword && password !== confirmPassword)}
              className="w-full cta-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <span><Loader2 className="h-5 w-5 mr-2 animate-spin" /></span>
                  <span>Setting up...</span>
                </>
              ) : (
                <span>Join {campName}</span>
              )}
            </button>
          </form>
        </div>

        {/* Already have an account */}
        <div className="mt-6 text-center">
          <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
            Already have an account?{' '}
            <Link href="/login" className="text-gold hover:text-gold/80 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
