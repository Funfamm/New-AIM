import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { findOrCreateSubtitle } from "@/lib/subtitles/subtitle-repo";

// POST /api/admin/subtitles/generate
// Body: { workId, mediaType? }
// Creates a subtitle record (if needed) + a "transcribe" job.
export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json() as { workId?: string; mediaType?: string; sourceLanguage?: string };
  const { workId, mediaType = "full", sourceLanguage = "auto" } = body;
  if (!workId) return NextResponse.json({ error: "workId required" }, { status: 400 });

  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { masterVideoKey: true, masterTrailerKey: true, masterPreviewKey: true },
  });
  if (!work) return NextResponse.json({ error: "Work not found" }, { status: 404 });

  const masterKey =
    mediaType === "trailer" ? work.masterTrailerKey :
    mediaType === "preview" ? work.masterPreviewKey :
    work.masterVideoKey;

  if (!masterKey) {
    const fieldLabel =
      mediaType === "trailer" ? "master trailer" :
      mediaType === "preview" ? "master preview" :
      "master video";
    return NextResponse.json(
      { error: `No ${fieldLabel} source file uploaded for this work. Upload the master MP4 before generating subtitles.` },
      { status: 422 }
    );
  }

  // Find or create the subtitle record with the chosen source language
  const subtitle = await findOrCreateSubtitle(workId, mediaType, sourceLanguage);

  // Cancel any existing pending/processing job for this subtitle
  await prisma.subtitleJob.updateMany({
    where: { subtitleId: subtitle.id, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "FAILED", error: "Superseded by new generate request" },
  });

  // Create a transcription job
  const job = await prisma.subtitleJob.create({
    data: {
      subtitleId: subtitle.id,
      type: "transcribe",
      status: "PENDING",
      progress: 0,
    },
  });

  return NextResponse.json({ subtitleId: subtitle.id, jobId: job.id }, { status: 201 });
}
