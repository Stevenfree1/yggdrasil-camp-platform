import {
  formatDateOnly,
  formatDayLong,
  formatDayShort,
  toDateInputValue,
  fromDateInputValue,
} from '../../lib/dates';

describe('date-only formatting is timezone-safe', () => {
  // The exact bug: a build day stored at midnight UTC on Wednesday Aug 26 2026
  // rendered as "Tuesday, Aug 25" for any viewer west of UTC.
  const midnightUtcWednesday = '2026-08-26T00:00:00.000Z';

  it('keeps a midnight-UTC date on its true calendar day', () => {
    expect(formatDayLong(midnightUtcWednesday)).toBe('Wednesday, Aug 26');
  });

  it('keeps noon-UTC dates correct too (older seeded rows)', () => {
    expect(formatDayLong('2025-08-20T12:00:00.000Z')).toBe('Wednesday, Aug 20');
  });

  it('formats the compact form', () => {
    expect(formatDayShort(midnightUtcWednesday)).toBe('Wed, Aug 26');
  });

  it('formats the default date form', () => {
    expect(formatDateOnly(midnightUtcWednesday)).toBe('Aug 26, 2026');
  });

  it('accepts Date objects as well as strings', () => {
    expect(formatDayLong(new Date(midnightUtcWednesday))).toBe('Wednesday, Aug 26');
  });

  it('returns the fallback for empty or invalid values', () => {
    expect(formatDayLong(null)).toBe('Unscheduled');
    expect(formatDayShort(undefined)).toBe('TBD');
    expect(formatDateOnly('not a date')).toBe('TBD');
    expect(formatDateOnly(null, undefined, '—')).toBe('—');
  });
});

describe('date input round-tripping', () => {
  it('extracts the UTC calendar date for a date input', () => {
    expect(toDateInputValue('2026-08-26T00:00:00.000Z')).toBe('2026-08-26');
    expect(toDateInputValue('')).toBe('');
  });

  it('stores form dates at noon UTC so they cannot shift', () => {
    const d = fromDateInputValue('2026-08-26');
    expect(d?.toISOString()).toBe('2026-08-26T12:00:00.000Z');
  });

  it('rejects malformed input', () => {
    expect(fromDateInputValue('26/08/2026')).toBeNull();
    expect(fromDateInputValue('')).toBeNull();
  });

  it('round-trips through both directions', () => {
    const stored = fromDateInputValue('2026-08-29');
    expect(toDateInputValue(stored)).toBe('2026-08-29');
    expect(formatDayLong(stored)).toBe('Saturday, Aug 29');
  });
});
