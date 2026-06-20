import "server-only";
import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

// Constant-time string comparison. Returns false on length mismatch without
// leaking timing, so an attacker cannot recover the secret byte-by-byte.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyWorkerSecret(req: NextRequest): boolean {
  const secret = process.env.WORKER_SHARED_SECRET ?? process.env.WORKER_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;

  return safeEqual(auth.slice(7), secret);
}
