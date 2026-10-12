import { cn, formatDate, formatCurrency } from '../../lib/utils';

describe('cn (class name utility)', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('should handle undefined and null values', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('should merge tailwind classes correctly', () => {
    // twMerge should resolve conflicting tailwind classes
    expect(cn('px-4', 'px-6')).toBe('px-6');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should handle empty input', () => {
    expect(cn()).toBe('');
  });

  it('should handle object syntax from clsx', () => {
    expect(cn({ 'text-bold': true, 'text-italic': false })).toBe('text-bold');
  });

  it('should handle array syntax', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });
});

describe('formatDate', () => {
  it('should format a Date object', () => {
    // Use noon UTC to avoid timezone-shift issues
    const date = new Date('2024-08-25T12:00:00Z');
    const result = formatDate(date);
    expect(result).toContain('August');
    expect(result).toContain('2024');
  });

  it('should format a date string', () => {
    const result = formatDate('2024-01-15T12:00:00Z');
    expect(result).toContain('January');
    expect(result).toContain('2024');
  });

  it('should format dates in en-US locale with month name', () => {
    const result = formatDate('2024-12-15T12:00:00Z');
    // Should use "December" not "12"
    expect(result).toContain('December');
  });

  it('should include full year', () => {
    const result = formatDate('2025-06-15T12:00:00Z');
    expect(result).toContain('2025');
  });

  it('should return a formatted string with month, day, and year', () => {
    const result = formatDate('2024-03-10T12:00:00Z');
    // Should match pattern like "March 10, 2024"
    expect(result).toMatch(/\w+ \d{1,2}, \d{4}/);
  });
});

describe('formatCurrency', () => {
  it('should format whole dollar amounts', () => {
    expect(formatCurrency(10000)).toBe('$100');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('should format large amounts with commas', () => {
    expect(formatCurrency(100000)).toBe('$1,000');
    expect(formatCurrency(100000000)).toBe('$1,000,000');
  });

  it('should round decimal amounts (no fraction digits)', () => {
    // minimumFractionDigits: 0, maximumFractionDigits: 0
    expect(formatCurrency(9999)).toBe('$100');
    expect(formatCurrency(9949)).toBe('$99');
  });

  it('should format negative amounts', () => {
    const result = formatCurrency(-5000);
    expect(result).toContain('50');
    // Should contain negative indicator
    expect(result).toMatch(/[-−]/);
  });
});
