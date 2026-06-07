"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

const ALLOWED_TARGETS = new Set(["videoUrl", "trailerUrl", "previewClipUrl"]);

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

/**
 * Admin-triggered: immediately create a PENDING job for a given work + target field.
 * Accepts the sourceKey explicitly (from form state) so admin can trigger processing
 * without needing to save the form first.
 * Returns an existing PENDING/PROCESSING job if one already exists for the same key+target.
 */
export async function startVideoProcessingJob(
  workId: string,
  targetField: "videoUrl" | "trailerUrl" | "previewClipUrl",
  sourceKey: string,
): Promise<{ jobId: string; status: string } | { error: string }> {
  await requireAdmin();

  if (!workId || !sourceKey || !targetField || !ALLOWED_TARGETS.has(targetField)) {
    return { error: "Missing or invalid fields." };
  }

  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { slug: true },
  });
  if (!work) return { error: "Work not found." };

  const existing = await prisma.videoProcessingJob.findFirst({
    where: { workId, sourceKey, targetField, status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true, status: true },
  });
  if (existing) return { jobId: existing.id, status: existing.status };

  const job = await prisma.videoProcessingJob.create({
    data: { workId, sourceKey, targetField, outputPrefix: "" },
  });
  await prisma.videoProcessingJob.update({
    where: { id: job.id },
    data: { outputPrefix: `works/${work.slug}/hls/${job.id}` },
  });

  return { jobId: job.id, status: "PENDING" };
}
