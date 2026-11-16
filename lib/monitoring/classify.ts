import type { ErrorLevel } from "@prisma/client";

// Severity classification for CLIENT errors that survive the ignore filter.
//
// Three tiers total:
//   1. ignore.ts        → drop entirely (pure teardown junk: aborts, extensions, [object Event])
//   2. THIS module      → keep-but-downgrade to WARN (real but TRANSIENT: a flaky fetch, a
//                          chunk that 404'd after a deploy, a momentary network drop)
//   3. everything else  → ERROR (a genuine bug worth paging on)
//
// A WARN is still persisted, counted, bucketed, trended, and visible/filterable in the
// admin monitor — it just does NOT fire email/webhook/the admin bell/spike alerts (the
// alertable gate in capture-error.ts is ERROR||FATAL). So a single transient blip shows a
// gold WARN badge instead of screaming like a crash, but if these SPIKE you still see it.
//
// Keep this list DISJOINT from ignore.ts: ignore = drop, classify = downgrade. No
// server-only imports here — the module stays client+server shareable like ignore.ts.
const TRANSIENT_CLIENT_PATTERNS: RegExp[] = [
  /\bLoad failed\b/i,                              // Safari: generic fetch failure
  /Failed to fetch/i,                              // Chromium: generic fetch failure
  /NetworkError when attempting to fetch/i,        // Firefox
  /\bnetwork\s*request\s*failed\b/i,
  /\bnetwork\s*timeout\b|request timed out/i,
  /Loading chunk\s+[\w-]+\s+failed/i,              // Next.js: stale chunk after a deploy (a reload fixes it)
  /\bChunkLoadError\b/i,
  /Loading CSS chunk/i,
  /error loading dynamically imported module/i,    // dynamic import() flakiness
  /Importing a module script failed/i,
  /^A network error occurred\.?$/i,                // WebKit: fetch dropped mid-flight
  /An unexpected response was received from the server/i, // Next.js Server Action reply wasn't RSC (connection dropped / proxy page / stale tab)
];

// SERVER-side requests that fail before reaching our code: a Server Action POST whose
// action id doesn't exist in this build (a tab left open across a deploy, or a bot
// replaying/forging the POST). Real but not actionable per-occurrence → WARN, so they
// stay visible and countable without paging.
const TRANSIENT_SERVER_PATTERNS: RegExp[] = [
  /Failed to find Server Action/i,
  /Invalid Server Actions request/i,
];

/** Level for an uncaught SERVER error: "WARN" for stale/forged Server Action posts, else "ERROR". */
export function serverErrorLevel(message: string | null | undefined): ErrorLevel {
  if (!message) return "ERROR";
  return TRANSIENT_SERVER_PATTERNS.some((re) => re.test(message)) ? "WARN" : "ERROR";
}

/**
 * Level for a client error message: "WARN" for known-benign-but-real transient failures
 * (worth counting, not worth paging), else "ERROR". Callers should run the ignore filter
 * FIRST (drop), then this (downgrade).
 */
export function clientErrorLevel(message: string | null | undefined): ErrorLevel {
  if (!message) return "ERROR";
  return TRANSIENT_CLIENT_PATTERNS.some((re) => re.test(message)) ? "WARN" : "ERROR";
}
