// Stateless HMAC-SHA256 tokens for welcome-email auto-login.
// No DB table — the AUTH_SECRET is the only shared secret.
// Token format: "${issuedAt}.${hmac}" where issuedAt is a Unix ms timestamp.
// TTL: 72 hours. Not single-use — the trade-off is acceptable for welcome emails.

import { createHmac } from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "";
const TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

function hmac(userId: string, iat: string): string {
  return createHmac("sha256", SECRET)
    .update(`welcome:${userId}:${iat}`)
    .digest("hex");
}

export function generateWelcomeToken(userId: string): string {
  const iat = Date.now().toString();
  return `${iat}.${hmac(userId, iat)}`;
}

export function verifyWelcomeToken(userId: string, token: string): boolean {
  try {
    const dotIdx = token.indexOf(".");
    if (dotIdx === -1) return false;
    const iatStr = token.slice(0, dotIdx);
    const sig    = token.slice(dotIdx + 1);
    const iat    = Number(iatStr);
    if (!iat || Date.now() - iat > TTL_MS) return false;
    const expected = hmac(userId, iatStr);
    // Constant-time compare to prevent timing attacks
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
