import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { findSubtitle } from "@/lib/subtitles/subtitle-repo";
import { prisma } from "@/lib/prisma";
import { SUBTITLE_TARGET_LANGS } from "@/lib/subtitles/subtitle-languages";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/subtitles/[id]/translate
// Body: { languages?: string[] }  — defaults to all 7 target languages
export async function POST(req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const subtitle = await findSubtitle(id);
  if (!subtitle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { languages?: string[] };
  const targetLangs = body.languages ?? [...SUBTITLE_TARGET_LANGS];

  // Cancel any existing pending/processing job
  await prisma.subtitleJob.updateMany({
    where: { subtitleId: id, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "FAILED", error: "Superseded by new translation request" },
  });

  const job = await prisma.subtitleJob.create({
    data: {
      subtitleId: id,
      type: "translate",
      status: "PENDING",
      languagesJson: targetLangs,
      progress: 0,
    },
  });

  return NextResponse.json({ job }, { status: 201 });
}
