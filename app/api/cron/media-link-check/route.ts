/**
 * GET /api/cron/media-link-check  (Vercel Cron — daily)
 *
 * HEAD-checks every public work's media URLs (video/trailer/preview/teaser + images)
 * and reports broken PLAYBACK links into the in-house error monitor — one stable
 * fingerprint per work+field, so each broken asset is one triageable group, the admin
 * bell rings, and the regression detector reopens it if it breaks again after a fix.
 * Broken images are returned in the response summary only (they fail soft in the UI).
 * Auth: Bearer CRON_SECRET. Schedule: "30 7 * * *".
 */

import { NextResponse } from "next/server";
import { checkAllWorkMediaLinks } from "@/lib/media-check";
import { captureError } from "@/lib/monitoring/capture-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { checked, broken, worksScanned } = await checkAllWorkMediaLinks();

  const playbackBroken = broken.filter((b) => b.kind === "playback");
  for (const b of playbackBroken) {
    // Message keeps title+field (stable per asset); numbers normalize to <n> in the
    // fingerprint, so 404 vs 503 for the same asset stays one group.
    captureError(
      new Error(`Broken media link: "${b.title}" ${b.field} → HTTP ${b.httpStatus ?? "unreachable"}`),
      {
        source: "SERVER",
        route: "/api/cron/media-link-check",
        metadata: { workId: b.workId, slug: b.slug, field: b.field, url: b.url, httpStatus: b.httpStatus },
      },
    );
  }

  // captureError is fire-and-forget; give its DB writes a moment to settle before the
  // function is suspended, or reports from this invocation could be lost.
  if (playbackBroken.length > 0) await new Promise((r) => setTimeout(r, 2_000));

  return NextResponse.json({
    ok: true,
    worksScanned,
    checked,
    broken: broken.length,
    playbackBroken: playbackBroken.map(({ slug, field, httpStatus }) => ({ slug, field, httpStatus })),
    imagesBroken: broken.filter((b) => b.kind === "image").length,
  });
}
