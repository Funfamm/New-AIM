"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * Creates a PENDING VideoProcessingJob for a given work + master source key.
 * Safe to call on every save — silently skips if an active or completed job
 * already exists for the same sourceKey.
 *
 * Call only from admin server actions (createWork / updateWork).
 */
export async function ensureVideoProcessingJob(
  workId: string,
  sourceKey: string,
  slug: string,
): Promise<void> {
  await requireAdmin();

  if (!workId || !sourceKey || !slug) return;

  // Skip if a job already exists for this exact source key with an active/done status
  const existing = await prisma.videoProcessingJob.findFirst({
    where: {
      workId,
      sourceKey,
      status: { in: ["PENDING", "PROCESSING", "READY"] },
    },
    select: { id: true },
  });

  if (existing) return;

  // Create job, then immediately set outputPrefix using the generated jobId
  await prisma.$transaction(async (tx) => {
    const job = await tx.videoProcessingJob.create({
      data: {
        workId,
        sourceKey,
        outputPrefix: "",
      },
    });
    await tx.videoProcessingJob.update({
      where: { id: job.id },
      data: { outputPrefix: `works/${slug}/hls/${job.id}` },
    });
  });
}
