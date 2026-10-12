import { TRPCError } from '@trpc/server';
import {
  assertRateLimit,
  normalizeRateLimitKey,
  resetRateLimitsForTests,
} from '../../server/lib/rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });

  it('normalizes empty and mixed-case keys', () => {
    expect(normalizeRateLimitKey('  TEST@Email.COM ')).toBe('test@email.com');
    expect(normalizeRateLimitKey('')).toBe('unknown');
    expect(normalizeRateLimitKey(undefined)).toBe('unknown');
  });

  it('throws after the limit is exceeded inside the window', () => {
    assertRateLimit({ key: 'login:test', limit: 2, windowMs: 60_000, action: 'login' });
    assertRateLimit({ key: 'login:test', limit: 2, windowMs: 60_000, action: 'login' });

    expect(() => {
      assertRateLimit({ key: 'login:test', limit: 2, windowMs: 60_000, action: 'login' });
    }).toThrow(TRPCError);
  });
});
