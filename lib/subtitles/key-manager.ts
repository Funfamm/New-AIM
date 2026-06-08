import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/server/crypto";

const RATE_LIMIT_COOLDOWN_MS = 65_000;   // 65s after a 429
const ERROR_COOLDOWN_MS = 5 * 60_000;   // 5min after other errors
const MAX_FAILURES_BEFORE_INVALID = 5;

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
 * Pick the least-recently-used healthy Gemini key from the DB pool.
 * Falls back to GEMINI_API_KEY env var if no DB keys are available.
 * Returns null if no key exists anywhere.
 */
export async function selectGeminiKey(): Promise<SelectedKey | null> {
  const now = new Date();

  const candidates = await prisma.translationApiKey.findMany({
    where: {
      provider: "gemini",
      isEnabled: true,
      status: { not: "INVALID" },
    },
    orderBy: [{ lastUsedAt: { sort: "asc", nulls: "first" } }],
  });

  // Filter out keys still in active cooldown (passive self-healing)
  const available = candidates.filter(
    (k) => !k.cooldownUntil || k.cooldownUntil <= now
  );

  for (const picked of available) {
    // Optimistic lastUsedAt update to reduce duplicate selection under concurrent workers
    await prisma.translationApiKey.update({
      where: { id: picked.id },
      data: { lastUsedAt: now },
    }).catch(() => {});

    try {
      const decryptedKey = decryptSecret(picked.encryptedKey);
      return { apiKeyId: picked.id, apiKeyName: picked.name, decryptedKey };
    } catch {
      // Encryption secret mismatch or corrupt ciphertext — disable this key
      await prisma.translationApiKey.update({
        where: { id: picked.id },
        data: {
          status: "INVALID",
          isEnabled: false,
          errorMessage: "Decryption failed — key may be corrupt or encryption secret changed",
          updatedAt: new Date(),
        },
      }).catch(() => {});
      continue;
    }
  }

  // Env var fallback
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) return { apiKeyId: null, apiKeyName: null, decryptedKey: envKey };

  return null;
}

/** Record a successful translation against a DB key. No-op if apiKeyId is null (env fallback). */
export async function markKeySuccess(apiKeyId: string): Promise<void> {
  await prisma.translationApiKey.update({
    where: { id: apiKeyId },
    data: {
      status: "HEALTHY",
      cooldownUntil: null,
      errorMessage: null,
      lastSuccessAt: new Date(),
      successCount: { increment: 1 },
      updatedAt: new Date(),
    },
  }).catch(() => {});
}

/** Record a failure, apply cooldown, and potentially mark the key INVALID. */
export async function markKeyFailure(apiKeyId: string, errorMessage: string): Promise<void> {
  const key = await prisma.translationApiKey.findUnique({ where: { id: apiKeyId } });
  if (!key) return;

  const rateLimit = isRateLimitError(errorMessage);
  const cooldownMs = rateLimit ? RATE_LIMIT_COOLDOWN_MS : ERROR_COOLDOWN_MS;
  const newFailureCount = key.failureCount + 1;
  const tooManyFailures = newFailureCount >= MAX_FAILURES_BEFORE_INVALID;

  await prisma.translationApiKey.update({
    where: { id: apiKeyId },
    data: {
      status: tooManyFailures ? "INVALID" : "COOLDOWN",
      isEnabled: tooManyFailures ? false : key.isEnabled,
      cooldownUntil: tooManyFailures ? null : new Date(Date.now() + cooldownMs),
      errorMessage: errorMessage.slice(0, 500),
      lastFailureAt: new Date(),
      failureCount: newFailureCount,
      updatedAt: new Date(),
    },
  }).catch(() => {});
}

/**
 * Returns true if a retry is viable — either a healthy DB key or the env fallback exists.
 * Used by the progress route to decide whether to auto-requeue a failed job.
 */
export async function hasHealthyKeysOrFallback(): Promise<boolean> {
  const now = new Date();
  const available = await prisma.translationApiKey.count({
    where: {
      provider: "gemini",
      isEnabled: true,
      status: { not: "INVALID" },
      OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }],
    },
  });
  if (available > 0) return true;
  return !!process.env.GEMINI_API_KEY;
}
