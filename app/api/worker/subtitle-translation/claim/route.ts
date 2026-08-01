import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findSubtitle } from "@/lib/subtitles/subtitle-repo";
import { selectGeminiKey } from "@/lib/subtitles/key-manager";
import { verifyWorkerSecret } from "@/lib/worker-auth";
import { getDownloadPresignedUrl } from "@/lib/r2Client";

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

  // Transcribe jobs use Whisper — resolve a signed URL for the private master MP4.
  if (claimed.type === "transcribe") {
    const work = await prisma.work.findUnique({
      where: { id: subtitle.workId },
      select: { masterVideoKey: true, masterTrailerKey: true, masterPreviewKey: true },
    });

    const masterKey =
      subtitle.mediaType === "trailer" ? (work?.masterTrailerKey ?? null) :
      subtitle.mediaType === "preview"  ? (work?.masterPreviewKey ?? null) :
      (work?.masterVideoKey ?? null);

    if (!masterKey) {
      await prisma.subtitleJob.update({
        where: { id: claimed.id },
        data: {
          status: "FAILED",
          error: "Subtitle transcription requires the original master MP4. No master source file found. Upload the master video before generating subtitles.",
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ job: null });
    }

    // Sign a 1-hour GET URL so the Python worker can download the private master file
    const videoUrl = await getDownloadPresignedUrl(masterKey, 3600);

    return NextResponse.json({
      job: {
        id: claimed.id,
        type: "transcribe",
        subtitleId: claimed.subtitleId,
        workId: subtitle.workId,
        mediaType: subtitle.mediaType,
        sourceLanguage: subtitle.sourceLanguage,
        videoUrl,
        apiKey: null,
        apiKeyId: null,
        apiKeyName: null,
      },
    });
  }

  // Translate job — select a Gemini key from the pool (pre-increments quota).
  const selectedKey = await selectGeminiKey();

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
