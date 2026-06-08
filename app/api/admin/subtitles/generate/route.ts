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
    select: { videoUrl: true, trailerUrl: true },
  });
  if (!work) return NextResponse.json({ error: "Work not found" }, { status: 404 });

  const videoUrl = mediaType === "trailer" ? work.trailerUrl : work.videoUrl;
  if (!videoUrl) {
    return NextResponse.json(
      { error: `No ${mediaType === "trailer" ? "trailer" : "video"} URL set on this work. Upload a video first.` },
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
