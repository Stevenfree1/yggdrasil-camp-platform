import { TRPCError } from '@trpc/server';

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
  action: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function prune(now: number) {
  if (buckets.size < MAX_BUCKETS) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size < MAX_BUCKETS) return;
  }

  const oldest = buckets.keys().next().value as string | undefined;
  if (oldest) buckets.delete(oldest);
}

export function normalizeRateLimitKey(value: string | undefined | null): string {
  return value?.trim().toLowerCase() || 'unknown';
}

export function assertRateLimit({ key, limit, windowMs, action }: RateLimitOptions) {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Too many ${action} attempts. Try again in ${retryAfterSeconds} seconds.`,
    });
  }
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
