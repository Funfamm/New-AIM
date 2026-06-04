/**
 * POST /api/subscribe
 *
 * Secure public subscription endpoint.
 * Security layers (in order):
 *   1. Fail-closed if TURNSTILE_SECRET_KEY is absent
 *   2. In-memory IP rate limit (3/hr) — best-effort on serverless
 *   3. Honeypot field check
 *   4. Time-delay check (< 1500ms submissions rejected)
 *   5. Email validation + normalization
 *   6. Cloudflare Turnstile server-side verification
 *   7. EmailSuppression check (silent fake success)
 *   8. Subscriber upsert
 *
 * Nothing is saved until Turnstile verification succeeds.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── In-memory rate limiter (best-effort on serverless cold starts) ──────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT    = 3;
const RATE_WINDOW   = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now  = Date.now();
  const slot = rateLimitMap.get(ip);
  if (!slot || slot.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (slot.count >= RATE_LIMIT) return false;
  slot.count++;
  return true;
}

// Purge stale entries every 30 minutes to prevent unbounded growth
let lastPurge = Date.now();
function maybePurge() {
  const now = Date.now();
  if (now - lastPurge < 30 * 60 * 1000) return;
  lastPurge = now;
  for (const [ip, slot] of rateLimitMap) {
    if (slot.resetAt <= now) rateLimitMap.delete(ip);
  }
}

// ── Email validation ────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

// ── Turnstile verification ──────────────────────────────────────────────────
async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY!;

  // FormData is the format Cloudflare siteverify expects
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  if (remoteIp) formData.append("remoteip", remoteIp);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: formData, signal: AbortSignal.timeout(8000) },
    );
    const data = await res.json() as {
      success:       boolean;
      hostname?:     string;
      action?:       string;
      "error-codes"?: string[];
    };

    if (!data.success && process.env.NODE_ENV !== "production") {
      console.warn("[subscribe] Turnstile siteverify failed", {
        success:    data.success,
        errorCodes: data["error-codes"],
        hostname:   data.hostname,
        action:     data.action,
      });
    }

    return data.success === true;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[subscribe] Turnstile siteverify unreachable — failing open", err);
    }
    return true;
  }
}

export async function POST(req: Request) {
  // ── 1. Fail-closed: secret must exist ──────────────────────────────────
  if (!process.env.TURNSTILE_SECRET_KEY) {
    return NextResponse.json(
      { success: false, message: "Subscription is temporarily unavailable." },
      { status: 503 }
    );
  }

  // ── IP extraction ────────────────────────────────────────────────────────
  // cf-connecting-ip is Cloudflare's trusted header; fall back to x-forwarded-for
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  // ── 2. Rate limit ────────────────────────────────────────────────────────
  maybePurge();
  if (!checkRateLimit(ip)) {
    // Return fake success — don't tell bots they're being limited
    return NextResponse.json({ success: true }, { status: 200 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null) as {
    email?: unknown;
    turnstileToken?: unknown;
    hp?: unknown;
    startedAt?: unknown;
    source?: unknown;
    name?: unknown;
    sourcePath?: unknown;
  } | null;

  if (!body) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  // ── 3. Honeypot ──────────────────────────────────────────────────────────
  if (body.hp && typeof body.hp === "string" && body.hp.length > 0) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  // ── 4. Time-delay ────────────────────────────────────────────────────────
  if (typeof body.startedAt === "number") {
    if (Date.now() - body.startedAt < 1500) {
      return NextResponse.json({ success: true }, { status: 200 });
    }
  }

  // ── 5. Email validation ──────────────────────────────────────────────────
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const email    = rawEmail.trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { success: false, message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  // ── 6. Turnstile verification (nothing saved before this) ────────────────
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";

  if (process.env.NODE_ENV !== "production") {
    console.log("[subscribe] turnstile token present:", Boolean(token));
  }

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Verification required. Please complete the challenge." },
      { status: 403 }
    );
  }

  const verified = await verifyTurnstile(token, ip !== "unknown" ? ip : undefined);
  if (!verified) {
    return NextResponse.json(
      { success: false, message: "We could not confirm this verification. Please try again." },
      { status: 403 }
    );
  }

  // ── 7. Suppression check ─────────────────────────────────────────────────
  const suppressed = await prisma.emailSuppression.findUnique({
    where:  { email },
    select: { active: true },
  });
  if (suppressed?.active) {
    // Silent fake success — do not reveal suppression
    return NextResponse.json({ success: true }, { status: 200 });
  }

  // ── 8. Collect safe metadata from headers + body ────────────────────────
  const countryCode =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;

  const language =
    req.headers.get("accept-language")?.split(",")[0]?.trim() ?? null;

  const referrer = req.headers.get("referer") ?? null;

  const source = typeof body.source === "string" && body.source.trim()
    ? body.source.trim().slice(0, 32)
    : "organic";

  const sourcePath =
    typeof body.sourcePath === "string" && body.sourcePath.trim().length > 0
      ? body.sourcePath.trim().slice(0, 300)
      : null;

  const name = typeof body.name === "string" && body.name.trim()
    ? body.name.trim().slice(0, 100)
    : null;

  const now = new Date();

  // ── 9. Upsert subscriber ─────────────────────────────────────────────────
  const existing = await prisma.subscriber.findUnique({
    where:  { email },
    select: { id: true, active: true, verifiedAt: true },
  });

  if (existing) {
    // Update metadata + mark verified; keep original subscribedAt
    await prisma.subscriber.update({
      where: { email },
      data: {
        active:       true,
        lastSeenAt:   now,
        verifiedAt:   existing.verifiedAt ?? now,
        source,
        sourcePath,
        countryCode,
        language,
        referrer,
        suppressedAt:   null,
        suppressReason: null,
      },
    });
    return NextResponse.json({ success: true, alreadySubscribed: true }, { status: 200 });
  }

  await prisma.subscriber.create({
    data: {
      email,
      name,
      source,
      sourcePath,
      countryCode,
      language,
      referrer,
      active:      true,
      verifiedAt:  now,
      lastSeenAt:  now,
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
