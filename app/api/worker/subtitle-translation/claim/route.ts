import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findSubtitle } from "@/lib/subtitles/subtitle-repo";
import { selectGeminiKey } from "@/lib/subtitles/key-manager";
import { verifyWorkerSecret } from "@/lib/worker-auth";

// POST /api/worker/subtitle-translation/claim
// Worker polls this to pick up pending translation jobs.
// Returns { job } with a decrypted apiKey — worker routes are the only callers.
export async function POST(req: NextRequest) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await prisma.subtitleJob.findFirst({
    where: { status: "PENDING", type: "translate" },
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

  // Select a translation key (DB pool → env fallback).
  // Decrypted key is returned here because this is a worker-only route, verified above.
  const selectedKey = await selectGeminiKey();
  if (!selectedKey) {
    await prisma.subtitleJob.update({
      where: { id: claimed.id },
      data: { status: "FAILED", error: "No Gemini API key available", updatedAt: new Date() },
    });
    return NextResponse.json({ job: null });
  }

  return NextResponse.json({
    job: {
      id: claimed.id,
      subtitleId: claimed.subtitleId,
      languages: claimed.languagesJson as string[],
      sourceLanguage: subtitle.sourceLanguage,
      segments: subtitle.segmentsJson,
      // Key injection — only ever sent to authenticated worker routes
      apiKey: selectedKey.decryptedKey,
      apiKeyId: selectedKey.apiKeyId,
      apiKeyName: selectedKey.apiKeyName,
    },
  });
}
