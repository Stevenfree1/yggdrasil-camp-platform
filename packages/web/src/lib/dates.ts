/**
 * Timezone-safe formatting for **date-only** values.
 *
 * Build days, shift days, strike days, season milestones and arrival dates are
 * calendar dates, not moments in time — but Prisma stores them as DateTime, and
 * the rows created through the app land on midnight UTC. Formatting those with
 * a plain `toLocaleDateString()` renders them in the viewer's zone, so anywhere
 * west of UTC every date displays one day early: midnight UTC Aug 26 becomes
 * 5pm Aug 25 in Pacific. That is how "Wednesday — Survey and Deliveries"
 * ended up labelled "Tuesday, Aug 25" on the build page.
 *
 * Formatting in UTC pins the calendar date regardless of the viewer's zone, and
 * is also correct for the older rows stored at noon UTC.
 *
 * Use these for date-only fields. For real timestamps (payment paidAt,
 * application submittedAt) keep formatting in local time — there, the viewer's
 * zone is the point.
 */

/** Locale-format a date-only value, pinned to UTC so the calendar day cannot shift. */
export function formatDateOnly(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
  fallback = 'TBD',
): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}

/** "Wednesday, Aug 26" — the long form used on build and strike day cards. */
export function formatDayLong(value: string | Date | null | undefined, fallback = 'Unscheduled'): string {
  return formatDateOnly(value, { weekday: 'long', month: 'short', day: 'numeric' }, fallback);
}

/** "Wed, Aug 26" — the compact form used in shift lists. */
export function formatDayShort(value: string | Date | null | undefined, fallback = 'TBD'): string {
  return formatDateOnly(value, { weekday: 'short', month: 'short', day: 'numeric' }, fallback);
}

/** The UTC calendar date as `YYYY-MM-DD`, for date inputs and CSV columns. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Turn a `YYYY-MM-DD` form value into an instant safe to store for a date-only
 * field: **noon UTC**, which lands on the same calendar day in every timezone
 * the camp operates in, so a future local-time render can't shift it either.
 */
export function fromDateInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T12:00:00.000Z`);
}
