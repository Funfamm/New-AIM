import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/subtitles/[id]/job  — poll latest job status
export async function GET(_req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const job = await prisma.subtitleJob.findFirst({
    where: { subtitleId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, status: true, progress: true, error: true, languagesJson: true, createdAt: true, updatedAt: true },
  });

  if (!job) return NextResponse.json({ job: null });
  return NextResponse.json({ job });
}

// PATCH /api/admin/subtitles/[id]/job  — reset a stuck PROCESSING/PENDING job back to PENDING
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const job = await prisma.subtitleJob.findFirst({
    where: { subtitleId: id, status: { in: ["PROCESSING", "PENDING"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!job) return NextResponse.json({ error: "No active job to reset" }, { status: 404 });

  const updated = await prisma.subtitleJob.update({
    where: { id: job.id },
    data: { status: "PENDING", progress: 0, error: null, updatedAt: new Date() },
    select: { id: true, type: true, status: true, progress: true, error: true, languagesJson: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ job: updated });
}
