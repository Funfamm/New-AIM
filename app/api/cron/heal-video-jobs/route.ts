/**
 * POST /api/cron/heal-video-jobs
 *
 * Self-healing cron — detects VideoProcessingJobs stuck in PROCESSING
 * for > 15 minutes (worker crashed / timed out) and either resets them
 * to PENDING for retry or marks them FAILED after MAX_AUTO_RETRIES.
 *
 * Protected by CRON_SECRET. Add to vercel.json schedule.
 * Recommended schedule: every 15 minutes  "* /15 * * * *"
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 min
const MAX_AUTO_RETRIES   = 3;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckJobs = await prisma.videoProcessingJob.findMany({
    where: { status: "PROCESSING", updatedAt: { lt: stuckCutoff } },
    select: { id: true, workId: true, attempts: true, targetField: true },
  });

  if (stuckJobs.length === 0) {
    return NextResponse.json({ ok: true, stuckFound: 0, recovered: 0, markedFailed: 0 });
  }

  const recoverable = stuckJobs.filter((j) => j.attempts < MAX_AUTO_RETRIES);
  const terminal    = stuckJobs.filter((j) => j.attempts >= MAX_AUTO_RETRIES);

  if (recoverable.length > 0) {
    await prisma.videoProcessingJob.updateMany({
      where: { id: { in: recoverable.map((j) => j.id) } },
      data: {
        status: "PENDING",
        progress: 0,
        errorMessage: null,
        attempts: { increment: 1 },
        startedAt: null,
      },
    });
  }

  if (terminal.length > 0) {
    await prisma.videoProcessingJob.updateMany({
      where: { id: { in: terminal.map((j) => j.id) } },
      data: {
        status: "FAILED",
        errorMessage: `Worker timeout — exceeded ${MAX_AUTO_RETRIES} auto-retry attempts. Manual retry required.`,
      },
    });
  }

  // Notify admin users in-app
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
    select: { id: true },
  });

  if (admins.length > 0) {
    const parts: string[] = [];
    if (recoverable.length > 0) {
      parts.push(`${recoverable.length} job${recoverable.length === 1 ? "" : "s"} reset to queue`);
    }
    if (terminal.length > 0) {
      parts.push(`${terminal.length} job${terminal.length === 1 ? "" : "s"} require manual retry`);
    }

    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type:  "SYSTEM" as const,
        title: `Self-Heal: ${stuckJobs.length} stuck video job${stuckJobs.length === 1 ? "" : "s"} found`,
        body:  parts.join(". "),
        href:  "/admin/works",
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    stuckFound:  stuckJobs.length,
    recovered:   recoverable.length,
    markedFailed: terminal.length,
  });
}
