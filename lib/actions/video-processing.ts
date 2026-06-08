"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "@/lib/r2Client";

const ALLOWED_TARGETS = new Set(["videoUrl", "trailerUrl", "previewClipUrl"]);
const BUCKET = process.env.R2_BUCKET_NAME!;

async function r2ObjectExists(key: string): Promise<boolean> {
  try {
    const client = getS3Client();
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

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

  // Skip silently if the source file was deleted from R2 (prevents queuing a job that will 404)
  if (!(await r2ObjectExists(sourceKey))) return;

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

  // Cancel stale FAILED jobs for old source keys so the latest-job query stays clean
  await prisma.videoProcessingJob.updateMany({
    where: { workId, targetField, status: "FAILED", sourceKey: { not: sourceKey } },
    data: { status: "CANCELLED" },
  });

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

  // Verify the master file still exists in R2 before queuing
  if (!(await r2ObjectExists(sourceKey))) {
    return { error: "Master file not found in storage. Please upload the master video again." };
  }

  // Cancel stale FAILED jobs for old source keys so the panel shows the new job
  await prisma.videoProcessingJob.updateMany({
    where: { workId, targetField, status: "FAILED", sourceKey: { not: sourceKey } },
    data: { status: "CANCELLED" },
  });

  const job = await prisma.videoProcessingJob.create({
    data: { workId, sourceKey, targetField, outputPrefix: "" },
  });
  await prisma.videoProcessingJob.update({
    where: { id: job.id },
    data: { outputPrefix: `works/${work.slug}/hls/${job.id}` },
  });

  return { jobId: job.id, status: "PENDING" };
}

