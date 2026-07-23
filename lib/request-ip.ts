import "server-only";
import { headers } from "next/headers";
import { hashValue } from "@/lib/security";

// Best-effort client IP, preferring Cloudflare's trusted header, then Vercel's, then
// the leftmost X-Forwarded-For (spoofable if not strictly behind a trusted proxy —
// acceptable as a rate-limit key alongside email/cookie keys, not as an identity).
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** SHA-256 of the client IP — never store or log the raw IP. */
export async function getClientIpHash(): Promise<string> {
  return hashValue(await getClientIp());
}
