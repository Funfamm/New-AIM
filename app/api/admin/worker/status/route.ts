import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const WORKER_URL = (process.env.WORKER_URL ?? "http://127.0.0.1:4242").replace(/\/$/, "");

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Primary: direct HTTP health check against the worker process
  try {
    const res = await fetch(`${WORKER_URL}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json() as { status?: string; busy?: boolean; uptime?: number };
      return NextResponse.json({ online: true, busy: !!data.busy, uptime: data.uptime ?? 0 });
    }
  } catch {
    // fall through to DB fallback
  }

  // Fallback: if the worker can't be reached directly (e.g. WORKER_URL not set in prod),
  // check the DB for a job updated in the last 2 minutes — that proves the worker is alive.
  try {
    const recentJob = await prisma.videoProcessingJob.findFirst({
      where: {
        status: "PROCESSING",
        updatedAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recentJob) {
      return NextResponse.json({ online: true, busy: true, source: "db" });
    }
  } catch {
    // ignore DB errors — fall through to offline
  }

  return NextResponse.json({ online: false });
}
