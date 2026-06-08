import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findSubtitle } from "@/lib/subtitles/subtitle-repo";
import { selectGeminiKey } from "@/lib/subtitles/key-manager";
import { verifyWorkerSecret } from "@/lib/worker-auth";

// POST /api/worker/subtitle-translation/claim
// Worker polls this to pick up pending jobs (translate or transcribe).
// Returns { job } with a decrypted apiKey — worker routes are the only callers.
export async function POST(req: NextRequest) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Claim the oldest pending job (translate or transcribe)
  const job = await prisma.subtitleJob.findFirst({
    where: { status: "PENDING", type: { in: ["translate", "transcribe"] } },
    orderBy: { createdAt: "asc" },
  });

  if (!job) return NextResponse.json({ job: null });

  const claimed = await prisma.subtitleJob.update({
    where: { id: job.id, status: "PENDING" },
    data: { status: "PROCESSING", updatedAt: new Date() },
  }).catch(() => null);

  if (!claimed) return NextResponse.json({ job: null }); // race: another worker claimed it

  const subtitle = await findSubtitle(claimed.subtitleId);
  if (!subtitle) {
    await prisma.subtitleJob.update({
      where: { id: claimed.id },
      data: { status: "FAILED", error: "Subtitle record not found", updatedAt: new Date() },
    });
    return NextResponse.json({ job: null });
  }

  // Select a Gemini API key (DB pool → env fallback).
  // Transcription jobs may not need it (whisper provider), so we resolve it
  // without failing here — the worker checks its own TRANSCRIPTION_PROVIDER.
  const selectedKey = await selectGeminiKey();

  if (claimed.type === "transcribe") {
    const work = await prisma.work.findUnique({
      where: { id: subtitle.workId },
      select: { videoUrl: true, trailerUrl: true },
    });
    const videoUrl =
      subtitle.mediaType === "trailer" ? (work?.trailerUrl ?? null) : (work?.videoUrl ?? null);

    if (!videoUrl) {
      await prisma.subtitleJob.update({
        where: { id: claimed.id },
        data: { status: "FAILED", error: "No video URL found for this work", updatedAt: new Date() },
      });
      return NextResponse.json({ job: null });
    }

    return NextResponse.json({
      job: {
        id: claimed.id,
        type: "transcribe",
        subtitleId: claimed.subtitleId,
        workId: subtitle.workId,
        mediaType: subtitle.mediaType,
        sourceLanguage: subtitle.sourceLanguage,
        videoUrl,
        // apiKey may be null when whisper is the active provider (worker handles it)
        apiKey: selectedKey?.decryptedKey ?? null,
        apiKeyId: selectedKey?.apiKeyId ?? null,
        apiKeyName: selectedKey?.apiKeyName ?? null,
      },
    });
  }

  // Default: translate job — always requires Gemini key
  if (!selectedKey) {
    await prisma.subtitleJob.update({
      where: { id: claimed.id },
      data: { status: "FAILED", error: "No Gemini API key available for translation. Add a key in Settings.", updatedAt: new Date() },
    });
    return NextResponse.json({ job: null });
  }

  return NextResponse.json({
    job: {
      id: claimed.id,
      type: "translate",
      subtitleId: claimed.subtitleId,
      languages: claimed.languagesJson as string[],
      sourceLanguage: subtitle.sourceLanguage,
      segments: subtitle.segmentsJson,
      apiKey: selectedKey.decryptedKey,
      apiKeyId: selectedKey.apiKeyId,
      apiKeyName: selectedKey.apiKeyName,
    },
  });
}
