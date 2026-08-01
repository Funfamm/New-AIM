// Stateless HMAC-SHA256 tokens for welcome-email auto-login.
// No DB table — the AUTH_SECRET is the only shared secret.
// Token format: "${issuedAt}.${hmac}" where issuedAt is a Unix ms timestamp.
// TTL: 72 hours. Not single-use — the trade-off is acceptable for welcome emails.

const SECRET = process.env.AUTH_SECRET ?? "";
const TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function hmac(userId: string, iat: string): Promise<string> {
  const key = await getHmacKey();
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`welcome:${userId}:${iat}`));
  return hexEncode(sig);
}

export async function generateWelcomeToken(userId: string): Promise<string> {
  const iat = Date.now().toString();
  return `${iat}.${await hmac(userId, iat)}`;
}

export async function verifyWelcomeToken(userId: string, token: string): Promise<boolean> {
  try {
    const dotIdx = token.indexOf(".");
    if (dotIdx === -1) return false;
    const iatStr = token.slice(0, dotIdx);
    const sig    = token.slice(dotIdx + 1);
    const iat    = Number(iatStr);
    if (!iat || Date.now() - iat > TTL_MS) return false;
    const expected = await hmac(userId, iatStr);
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
