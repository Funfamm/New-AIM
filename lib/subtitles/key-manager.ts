import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/server/crypto";

const RATE_LIMIT_COOLDOWN_MS     = 65_000;       // 65s after a 429
const ERROR_COOLDOWN_MS          = 5 * 60_000;   // 5min after other errors
const MAX_FAILURES_BEFORE_INVALID = 5;
const WINDOW_DURATION_MS         = 24 * 60 * 60 * 1000; // 24h quota window

export type KeyTask = "TRANSLATION" | "CASTING_AUDITION";

export function isRateLimitError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    msg.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted") ||
    lower.includes("too many requests")
  );
}

export type SelectedKey = {
  apiKeyId: string | null;   // null = env fallback (GEMINI_API_KEY)
  apiKeyName: string | null;
  decryptedKey: string;
};

/**
 * Pick the best available Gemini key for a specific task using quota-aware selection.
 *
 * Only keys whose taskScopes includes the requested task are considered.
 *
 * Priority order:
 *   1. Enabled, not INVALID, not in active cooldown
 *   2. Not over quota for the current window
 *   3. Most remaining quota (proactive rotation before hitting limits)
 *   4. Least recently used (LRU tie-breaker)
 *   5. Lowest failure count
 *
 * Falls back to GEMINI_API_KEY env var if no DB keys are available.
 */
export async function selectGeminiKeyForTask(task: KeyTask): Promise<SelectedKey | null> {
  const now = new Date();

  const candidates = await prisma.translationApiKey.findMany({
    where: {
      provider:   "gemini",
      isEnabled:  true,
      status:     { not: "INVALID" },
      taskScopes: { has: task },
    },
  });

  // Score each key; drop cooldown keys and keys over quota
  const scored = candidates
    .filter((k) => !(k.cooldownUntil && k.cooldownUntil > now))
    .map((k) => {
      const windowExpired = !k.windowResetAt || k.windowResetAt <= now;
      const effectiveUsed = windowExpired ? 0 : k.usedInWindow;
      const remaining     = k.windowMaxCalls - effectiveUsed;
      return { k, windowExpired, remaining };
    })
    .filter((s) => s.remaining > 0)
    .sort((a, b) => {
      // 1. Most remaining quota
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      // 2. Least recently used
      const aLast = a.k.lastUsedAt?.getTime() ?? 0;
      const bLast = b.k.lastUsedAt?.getTime() ?? 0;
      if (aLast !== bLast) return aLast - bLast;
      // 3. Fewer failures
      return a.k.failureCount - b.k.failureCount;
    });

  for (const { k, windowExpired } of scored) {
    // Reset or advance the quota window, then pre-increment usage
    const newWindowResetAt  = windowExpired
      ? new Date(now.getTime() + WINDOW_DURATION_MS)
      : k.windowResetAt!;
    const newUsedInWindow = windowExpired ? 1 : k.usedInWindow + 1;

    await prisma.translationApiKey.update({
      where: { id: k.id },
      data: {
        lastUsedAt:    now,
        usedInWindow:  newUsedInWindow,
        windowResetAt: newWindowResetAt,
        updatedAt:     now,
      },
    }).catch(() => {});

    try {
      const decryptedKey = decryptSecret(k.encryptedKey);
      return { apiKeyId: k.id, apiKeyName: k.name, decryptedKey };
    } catch {
      await prisma.translationApiKey.update({
        where: { id: k.id },
        data: {
          status:       "INVALID",
          isEnabled:    false,
          errorMessage: "Decryption failed — key may be corrupt or encryption secret changed",
          updatedAt:    new Date(),
        },
      }).catch(() => {});
      continue;
    }
  }

  // Env var fallback (only for TRANSLATION — casting must use DB keys explicitly)
  if (task === "TRANSLATION") {
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) return { apiKeyId: null, apiKeyName: null, decryptedKey: envKey };
  }

  return null;
}

/**
 * Legacy alias — preserved for the subtitle worker route.
 * Internally delegates to selectGeminiKeyForTask("TRANSLATION").
 */
export async function selectGeminiKey(): Promise<SelectedKey | null> {
  return selectGeminiKeyForTask("TRANSLATION");
}

/** Record a successful translation against a DB key. No-op if apiKeyId is null (env fallback). */
export async function markKeySuccess(apiKeyId: string): Promise<void> {
  await prisma.translationApiKey.update({
    where: { id: apiKeyId },
    data: {
      status:       "HEALTHY",
      cooldownUntil: null,
      errorMessage:  null,
      lastSuccessAt: new Date(),
      successCount:  { increment: 1 },
      updatedAt:     new Date(),
    },
  }).catch(() => {});
}

/** Record a failure, apply cooldown, and potentially mark the key INVALID. */
export async function markKeyFailure(apiKeyId: string, errorMessage: string): Promise<void> {
  const key = await prisma.translationApiKey.findUnique({ where: { id: apiKeyId } });
  if (!key) return;

  const rateLimit       = isRateLimitError(errorMessage);
  const cooldownMs      = rateLimit ? RATE_LIMIT_COOLDOWN_MS : ERROR_COOLDOWN_MS;
  const newFailureCount = key.failureCount + 1;
  const tooManyFailures = newFailureCount >= MAX_FAILURES_BEFORE_INVALID;

  await prisma.translationApiKey.update({
    where: { id: apiKeyId },
    data: {
      status:        tooManyFailures ? "INVALID" : "COOLDOWN",
      isEnabled:     tooManyFailures ? false : key.isEnabled,
      cooldownUntil: tooManyFailures ? null : new Date(Date.now() + cooldownMs),
      errorMessage:  errorMessage.slice(0, 500),
      lastFailureAt: new Date(),
      failureCount:  newFailureCount,
      updatedAt:     new Date(),
    },
  }).catch(() => {});
}

/**
 * Returns true if a retry is viable for TRANSLATION — either a healthy DB key with quota
 * or the env fallback exists.
 */
export async function hasHealthyKeysOrFallback(): Promise<boolean> {
  return hasHealthyKeysForTask("TRANSLATION") || !!process.env.GEMINI_API_KEY;
}

/** Returns true if at least one healthy, quota-available DB key exists for the given task. */
export async function hasHealthyKeysForTask(task: KeyTask): Promise<boolean> {
  const now = new Date();

  const candidates = await prisma.translationApiKey.findMany({
    where: {
      provider:   "gemini",
      isEnabled:  true,
      status:     { not: "INVALID" },
      taskScopes: { has: task },
      OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
    },
    select: { usedInWindow: true, windowMaxCalls: true, windowResetAt: true },
  });

  return candidates.some((k) => {
    const windowExpired = !k.windowResetAt || k.windowResetAt <= now;
    const effectiveUsed = windowExpired ? 0 : k.usedInWindow;
    return effectiveUsed < k.windowMaxCalls;
  });
}
