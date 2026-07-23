import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { verifyWorkerSecret } from "@/lib/worker-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const body = await req.json();
  const hlsUrl = (body.hlsUrl as string | undefined)?.trim();

  if (!hlsUrl) {
    return NextResponse.json({ error: "hlsUrl is required" }, { status: 400 });
  }

  const job = await prisma.videoProcessingJob.findUnique({
    where: { id: jobId },
    select: { workId: true, status: true, targetField: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "PROCESSING") {
    return NextResponse.json(
      { error: "Job is not in PROCESSING state" },
      { status: 409 },
    );
  }

  const workUpdate =
    job.targetField === "trailerUrl"    ? { trailerUrl: hlsUrl }
    : job.targetField === "previewClipUrl" ? { previewClipUrl: hlsUrl }
    : { videoUrl: hlsUrl };

  await prisma.$transaction([
    prisma.videoProcessingJob.update({
      where: { id: jobId },
      data: { status: "READY", progress: 100, hlsUrl, completedAt: new Date() },
    }),
    prisma.work.update({
      where: { id: job.workId },
      data: workUpdate,
    }),
  ]);

  // A completed HLS job writes videoUrl/trailerUrl/previewClipUrl onto the Work,
  // which drives the homepage hero CTA. The homepage caches Work data, so purge the
  // "works" tag (curated rows carry it too) or the hero stays stale until an unrelated
  // admin save. This runs in a route-handler request context, so revalidateTag is valid.
  revalidateTag(CACHE_TAGS.works);

  return NextResponse.json({ ok: true });
}
