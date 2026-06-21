import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDownloadPresignedUrl } from "@/lib/r2Client";
import { verifyWorkerSecret } from "@/lib/worker-auth";

export async function POST(req: NextRequest) {
  if (!verifyWorkerSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.videoProcessingJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, workId: true, sourceKey: true, outputPrefix: true, startedAt: true },
  });

  if (!pending) {
    return NextResponse.json({ job: null });
  }

  // Atomic claim: only succeeds if still PENDING (safe against parallel workers)
  const claimed = await prisma.videoProcessingJob.updateMany({
    where: { id: pending.id, status: "PENDING" },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      ...(pending.startedAt == null ? { startedAt: new Date() } : {}),
    },
  });

  if (claimed.count === 0) {
    return NextResponse.json({ job: null });
  }

  const work = await prisma.work.findUnique({
    where: { id: pending.workId },
    select: { slug: true, title: true },
  });

  const signedDownloadUrl = await getDownloadPresignedUrl(pending.sourceKey, 3600);

  return NextResponse.json({
    job: {
      jobId: pending.id,
      workId: pending.workId,
      sourceKey: pending.sourceKey,
      outputPrefix: pending.outputPrefix,
      signedDownloadUrl,
      workSlug: work?.slug ?? null,
      workTitle: work?.title ?? null,
    },
  });
}
