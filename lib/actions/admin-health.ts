"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

export async function dismissVideoJob(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) return;
  await prisma.videoProcessingJob.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/admin");
}

export async function dismissSubtitleJob(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) return;
  await prisma.subtitleJob.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/admin");
}

export async function resolveAllVideoFailures() {
  await requireAdmin();
  await prisma.videoProcessingJob.updateMany({
    where: { status: "FAILED" },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/admin");
}

export async function resolveAllEmailFailures() {
  await requireAdmin();
  await prisma.emailQueue.updateMany({
    where: { status: "FAILED" },
    data: { status: "SKIPPED" },
  });
  revalidatePath("/admin");
}

export async function resolveAllSubtitleFailures() {
  await requireAdmin();
  await prisma.subtitleJob.updateMany({
    where: { status: "FAILED" },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/admin");
}
