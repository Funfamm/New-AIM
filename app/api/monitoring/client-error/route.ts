// POST /api/monitoring/client-error
// Ingests browser errors from ClientErrorReporter into the in-house monitor.
// Rate-limited per IP; always returns 200 (never reveals internals to clients).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { captureError } from "@/lib/monitoring/capture-error";
import { isIgnorableClientError } from "@/lib/monitoring/ignore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hits = new Map<string, { count: number; reset: number }>();
const LIMIT = 30;
const WINDOW_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const slot = hits.get(ip);
  if (!slot || slot.reset <= now) { hits.set(ip, { count: 1, reset: now + WINDOW_MS }); return false; }
  if (slot.count >= LIMIT) return true;
  slot.count++;
  return false;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";
  if (rateLimited(ip)) return NextResponse.json({ ok: true });

  const text = await req.text().catch(() => "");
  if (!text || text.length > 8_000) return NextResponse.json({ ok: true });

  let body: { message?: unknown; stack?: unknown; route?: unknown } | null = null;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ ok: true }); }
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ ok: true });
  }
  // Defense-in-depth: drop known-benign browser noise (aborted requests/media on
  // navigation, etc.) in case it comes from a stale client that lacks the filter.
  if (isIgnorableClientError(body.message)) return NextResponse.json({ ok: true });

  const session = await auth().catch(() => null);

  captureError(new Error(body.message.slice(0, 1000)), {
    source: "CLIENT",
    route:  typeof body.route === "string" ? body.route.slice(0, 300) : undefined,
    stack:  typeof body.stack === "string" ? body.stack.slice(0, 8000) : undefined,
    userId: session?.user?.id,
  });

  return NextResponse.json({ ok: true });
}
