"use server";
// Server Actions for watch progress — save and retrieve resume position

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// ── Save progress ─────────────────────────────────────────────
export async function saveWatchProgress(
  workId: string,
  seconds: number,
  durationMinutes?: number,
) {
  const session = await auth();
  if (!session?.user?.id) return;

  const duration = durationMinutes ?? null;
  // Mark complete when 90% of duration has been watched
  const completed = duration ? seconds >= duration * 60 * 0.9 : false;

  await prisma.watchProgress.upsert({
    where: { userId_workId: { userId: session.user.id, workId } },
    update: { seconds, duration, completed },
    create: { userId: session.user.id, workId, seconds, duration, completed: false },
  });
}

// ── Get progress for a single work ───────────────────────────
export async function getWatchProgress(workId: string): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  const record = await prisma.watchProgress.findUnique({
    where: { userId_workId: { userId: session.user.id, workId } },
    select: { seconds: true },
  });

  return record?.seconds ?? 0;
}

// ── Get all progress for user dashboard ───────────────────────
export async function getAllWatchProgress() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.watchProgress.findMany({
    where: { userId: session.user.id, completed: false },
    include: {
      work: {
        select: {
          id: true, title: true, slug: true,
          posterUrl: true, duration: true, type: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
