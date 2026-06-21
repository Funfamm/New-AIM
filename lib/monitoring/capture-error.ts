import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, ErrorLevel, ErrorSource } from "@prisma/client";

// In-house error monitoring — capture point.
//
// Scalability model: occurrences are AGGREGATED by fingerprint. The first time a
// unique error is seen we INSERT one row; every later occurrence INCREMENTs that
// row's count instead of inserting a new one. An additional per-instance, per-
// fingerprint time window drops repeat writes during a storm, so a hot error loop
// can never hammer the database. The capture call is fire-and-forget and never
// throws — monitoring must not be able to crash the app it monitors.

type CaptureContext = {
  level?:    ErrorLevel;
  source?:   ErrorSource;
  route?:    string | null;
  method?:   string | null;
  userId?:   string | null;
  /** Override stack (e.g. a browser stack forwarded from the client). */
  stack?:    string | null;
  metadata?: Record<string, unknown>;
};

const WINDOW_MS = 10_000;     // at most one DB write per fingerprint per 10s per instance
const MAX_KEYS  = 5_000;      // bound the throttle map on long-lived instances
const lastWrite = new Map<string, number>();

// Collapse the variable parts of a message so similar errors share one group.
function normalizeMessage(msg: string): string {
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hash>")
    .replace(/0x[0-9a-f]+/gi, "<addr>")
    .replace(/\b\d{2,}\b/g, "<n>")
    .slice(0, 500)
    .trim();
}

async function fingerprintFor(level: string, source: string, route: string, normMsg: string): Promise<string> {
  const data = new TextEncoder().encode(`${level}|${source}|${route}|${normMsg}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export function captureError(error: unknown, ctx: CaptureContext = {}): void {
  void (async () => {
    try {
      const level:  ErrorLevel  = ctx.level  ?? "ERROR";
      const source: ErrorSource = ctx.source ?? "SERVER";
      const route  = (ctx.route ?? "").slice(0, 300);

      const rawMessage = (error instanceof Error ? error.message : String(error)) || "Unknown error";
      const normMsg    = normalizeMessage(rawMessage);
      const fp         = await fingerprintFor(level, source, route, normMsg);

      // Per-instance storm throttle.
      const now  = Date.now();
      const last = lastWrite.get(fp);
      if (last && now - last < WINDOW_MS) return;
      if (lastWrite.size > MAX_KEYS) lastWrite.clear();
      lastWrite.set(fp, now);

      const message = rawMessage.slice(0, 1000);
      const stack   = (ctx.stack ?? (error instanceof Error ? error.stack : null) ?? null)?.slice(0, 8000) ?? null;
      const metadata = ctx.metadata != null ? (ctx.metadata as Prisma.InputJsonValue) : undefined;

      try {
        // New error group → INSERT (and alert).
        await prisma.errorLog.create({
          data: {
            fingerprint: fp,
            level, source, message, stack,
            route:      route || null,
            method:     ctx.method ?? null,
            lastUserId: ctx.userId ?? null,
            metadata,
          },
        });
        if (level === "ERROR" || level === "FATAL") {
          const { alertNewError } = await import("@/lib/monitoring/alert");
          void alertNewError({ level, source, message, route: route || null });
        }
      } catch (e) {
        // Existing group (unique fingerprint) → INCREMENT and refresh.
        if ((e as { code?: string })?.code === "P2002") {
          await prisma.errorLog.update({
            where: { fingerprint: fp },
            data: {
              count:      { increment: 1 },
              lastSeenAt: new Date(),
              message, stack,
              lastUserId: ctx.userId ?? null,
              resolved:   false,   // a resolved error that recurs is reopened
              resolvedAt: null,
              ...(metadata !== undefined ? { metadata } : {}),
            },
          }).catch(() => {});
        }
        // Any other error (e.g. table absent before the migration runs) is swallowed.
      }
    } catch {
      // never throw
    }
  })();
}
