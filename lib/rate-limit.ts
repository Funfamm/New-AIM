// Per-instance in-memory sliding window rate limiter.
// Works without Redis: Vercel function instances handle multiple requests before
// recycling, so this is effective against burst abuse from the same source.
// Not perfectly coordinated across all instances — upgrade to Upstash when needed.

const store = new Map<string, number[]>();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [key, hits] of store.entries()) {
    if (hits.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed:   boolean;
  remaining: number;
  resetMs:   number;
}

/**
 * Check and record a rate limit hit.
 * @param key      Unique identifier: userId, email, ipHash, or composite
 * @param limit    Max allowed hits within the window
 * @param windowMs Rolling window in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  cleanup();
  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (store.get(key) ?? []).filter((t) => t > windowStart);

  if (hits.length >= limit) {
    return { allowed: false, remaining: 0, resetMs: hits[0] + windowMs - now };
  }

  hits.push(now);
  store.set(key, hits);
  return { allowed: true, remaining: limit - hits.length, resetMs: windowMs };
}
