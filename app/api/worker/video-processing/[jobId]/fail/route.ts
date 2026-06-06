import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  const errorMessage = ((body.errorMessage as string | undefined) ?? "Unknown error").slice(0, 500);

  const updated = await prisma.videoProcessingJob.updateMany({
    where: { id: jobId, status: "PROCESSING" },
    data: { status: "FAILED", errorMessage, completedAt: new Date() },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Job not found or not in PROCESSING state" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
