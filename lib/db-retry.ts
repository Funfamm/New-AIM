import "server-only";
import { Prisma } from "@prisma/client";

// Neon serverless Postgres scales to zero after ~5 min idle and cold-starts in a few
// hundred ms. During that wake window the first query can fail with "Can't reach
// database server" (P1001), a connect timeout (P1002), or a pool-acquire timeout
// (P2024, when connections are slow to establish). These are TRANSIENT — a short
// backoff-and-retry rides out the cold start and serves the real page instead of
// failing/degrading. Neon explicitly recommends retry-with-exponential-backoff for this.
const RETRYABLE_CODES = new Set(["P1001", "P1002", "P2024"]);

function isRetryable(err: unknown): boolean {
  // "Can't reach database server" on connect surfaces as an initialization error.
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return RETRYABLE_CODES.has(err.code);
  return false;
}

/**
 * Retry a DB operation on transient connection errors with capped, jittered backoff.
 * Bounded (default 2 retries) so it rides out a Neon cold start WITHOUT becoming a
 * retry storm under genuine pool saturation. Non-transient errors rethrow immediately.
 * Compose OUTSIDE unstable_cache and INSIDE the graceful-degradation guard: retry first,
 * degrade only if every attempt fails.
 */
export async function withDbRetry<T>(
  op: () => Promise<T>,
  { retries = 2, baseMs = 150 }: { retries?: number; baseMs?: number } = {},
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await op();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) throw err;
      const backoff = baseMs * 2 ** attempt + Math.floor(Math.random() * baseMs);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      attempt += 1;
    }
  }
}
