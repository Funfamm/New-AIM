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
