'use client';

import { useState } from 'react';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  memberId: string;
  hasAvatar?: boolean;
  size?: AvatarSize;
  /** Cache-busting token (e.g. avatar updatedAt ms) appended as ?v= to the img src. */
  cacheKey?: string | number;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-[11px]', // 32px — roster + admin members
  md: 'h-10 w-10 text-xs', //   40px — profile banner
  lg: 'h-14 w-14 text-base', // 56px — directory
};

const BASE =
  'rounded-full shrink-0 overflow-hidden flex items-center justify-center';

/**
 * Canonical initials: first + last initial, single word -> first char,
 * empty -> '?'. (Replaces the roster's initials() and the directory's
 * getInitials() so both surfaces agree.)
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Member avatar. Renders the route-served WebP via a raw <img> (not next/image —
 * the served WebP is already encoded; re-routing it through the optimizer would
 * be a redundant second sharp encode on a CDN-less host). Falls back to the
 * neutral sage initials circle when there's no photo or the img errors.
 *
 * Renders cleanly as a <Link> child (no own <a>).
 */
export function Avatar({
  name,
  memberId,
  hasAvatar = false,
  size = 'sm',
  cacheKey,
  className = '',
}: AvatarProps) {
  const [errored, setErrored] = useState(false);

  const classes = `${BASE} ${SIZE_CLASSES[size]} ${className}`.trim();

  if (hasAvatar && !errored) {
    const src = `/api/avatar/${memberId}${cacheKey != null ? `?v=${cacheKey}` : ''}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={`${classes} object-cover`}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${classes} bg-sage/15 font-semibold text-sage`}
    >
      {initials(name)}
    </span>
  );
}
