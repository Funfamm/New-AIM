import "server-only";
import type { NextRequest } from "next/server";

export function verifyWorkerSecret(req: NextRequest): boolean {
  const secret = process.env.WORKER_SHARED_SECRET ?? process.env.WORKER_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;

  return auth.slice(7) === secret;
}
