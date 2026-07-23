/**
 * GET /api/cron/error-retention  (Vercel Cron — daily)
 *
 * Keeps the error store bounded: deletes resolved/ignored groups older than
 * ERROR_RETENTION_DAYS (default 30) and occurrence buckets older than
 * ERROR_BUCKET_RETENTION_DAYS (default 90). Auth: Bearer CRON_SECRET.
 * Schedule: "0 3 * * *".
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groupDays  = Math.max(1, Number(process.env.ERROR_RETENTION_DAYS) || 30);
  const bucketDays = Math.max(groupDays, Number(process.env.ERROR_BUCKET_RETENTION_DAYS) || 90);
  const groupCutoff  = new Date(Date.now() - groupDays  * 86_400_000);
  const bucketCutoff = new Date(Date.now() - bucketDays * 86_400_000);

  try {
    const [groups, buckets] = await prisma.$transaction([
      prisma.errorLog.deleteMany({ where: { status: { in: ["RESOLVED", "IGNORED"] }, lastSeenAt: { lt: groupCutoff } } }),
      prisma.errorEventBucket.deleteMany({ where: { bucketStart: { lt: bucketCutoff } } }),
    ]);
    return NextResponse.json({ ok: true, groupsDeleted: groups.count, bucketsDeleted: buckets.count, groupDays, bucketDays });
  } catch {
    return NextResponse.json({ ok: false, skipped: "tables not ready" });
  }
}
