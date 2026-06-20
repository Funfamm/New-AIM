import "server-only";
import { createHmac } from "crypto";

// A playback token is a path-prefix grant: whoever holds it may read any R2 object
// whose key starts with `prefix`, until `exp`. One token therefore covers a film's
// whole HLS folder — master playlist, every variant playlist, and every segment.
//
// Format:  base64url("<exp>:<prefix>") + "." + base64url(HMAC-SHA256(payload, key))
// The Cloudflare playback Worker re-derives and verifies this with Web Crypto using
// the same PLAYBACK_SIGNING_KEY. Keep the two in sync.

const DEFAULT_TTL_SECONDS = 3 * 60 * 60; // 3 hours — long enough to watch, short enough that a copied link dies

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Signs a path-prefix grant. Returns null when PLAYBACK_SIGNING_KEY is unset, so
 * callers fall back to the ungated URL (no behaviour change until the gate is live).
 */
export function signPlaybackToken(prefix: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): string | null {
  const key = process.env.PLAYBACK_SIGNING_KEY;
  if (!key) return null;

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${exp}:${prefix}`;
  const sig = createHmac("sha256", key).update(payload).digest();
  return `${b64url(payload)}.${b64url(sig)}`;
}
