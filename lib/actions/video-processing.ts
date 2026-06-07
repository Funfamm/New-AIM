"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * Creates a PENDING VideoProcessingJob for a given work + master source key.
 * Safe to call on every save — silently skips if an active or completed job
 * already exists for the same sourceKey + targetField combination.
 *
 * targetField controls which Work field the complete endpoint writes to:
 *   "videoUrl" (default) | "trailerUrl" | "previewClipUrl"
 */
export async function ensureVideoProcessingJob(
  workId: string,
  sourceKey: string,
  slug: string,
  targetField = "videoUrl",
): Promise<void> {
  await requireAdmin();

  if (!workId || !sourceKey || !slug) return;

  const existing = await prisma.videoProcessingJob.findFirst({
    where: {
      workId,
      sourceKey,
      targetField,
      status: { in: ["PENDING", "PROCESSING", "READY"] },
    },
    select: { id: true },
  });

  if (existing) return;

  await prisma.$transaction(async (tx) => {
    const job = await tx.videoProcessingJob.create({
      data: {
        workId,
        sourceKey,
        targetField,
        outputPrefix: "",
      },
    });
    await tx.videoProcessingJob.update({
      where: { id: job.id },
      data: { outputPrefix: `works/${slug}/hls/${job.id}` },
    });
  });
}
