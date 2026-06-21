import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateSubtitleById, saveSubtitleSegments } from "@/lib/subtitles/subtitle-repo";
import { markKeySuccess, markKeyFailure, hasHealthyKeysOrFallback } from "@/lib/subtitles/key-manager";
import { verifyWorkerSecret } from "@/lib/worker-auth";
import type { SubtitleSegment } from "@/lib/subtitles/subtitle-file-parser";

type ProgressBody = {
  jobId: string;
  status: "PROCESSING" | "READY" | "FAILED";
  progress?: number;
  error?: string;
  apiKeyId?: string | null;
  // On READY for translate: full translations + vtt keys
  translations?: Record<string, SubtitleSegment[]>;
  vttKeys?: Record<string, string>;
  // On READY for transcribe: source segments
  segments?: SubtitleSegment[];
};

// POST /api/worker/subtitle-translation/progress
export async function POST(req: NextRequest) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as ProgressBody;
  const { jobId, status, progress, error, apiKeyId, translations, vttKeys, segments } = body;

  if (!jobId || !status) {
    return NextResponse.json({ error: "jobId and status required" }, { status: 400 });
  }

  const job = await prisma.subtitleJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (status === "READY") {
    await prisma.subtitleJob.update({
      where: { id: jobId },
      data: { status: "READY", progress: 100, error: null, updatedAt: new Date() },
    });

    if (job.type === "transcribe" && segments) {
      // Save transcribed segments as source subtitles (resets to draft)
      await saveSubtitleSegments(job.subtitleId, segments, "auto_transcribe");
    } else if (job.type === "translate" && translations && vttKeys) {
      await updateSubtitleById(job.subtitleId, { translationsJson: translations, vttKeysJson: vttKeys });
    }

    if (apiKeyId) await markKeySuccess(apiKeyId);
  } else if (status === "FAILED") {
    const errorMsg = error ?? "Unknown error";

    await prisma.subtitleJob.update({
      where: { id: jobId },
      data: { status: "FAILED", progress: progress ?? job.progress, error: errorMsg, updatedAt: new Date() },
    });

    if (apiKeyId) await markKeyFailure(apiKeyId, errorMsg);

    // Auto-requeue translate jobs if another healthy key is available
    if (job.type === "translate") {
      const canRetry = await hasHealthyKeysOrFallback();
      if (canRetry) {
        await prisma.subtitleJob.update({
          where: { id: jobId },
          data: { status: "PENDING", error: null, progress: 0, updatedAt: new Date() },
        });
      }
    }
  } else {
    // PROCESSING intermediate update
    await prisma.subtitleJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING", progress: progress ?? job.progress, updatedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
