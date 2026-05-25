"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export async function saveWork(workId: string) {
  const userId = await requireUser();
  await prisma.savedWork.upsert({
    where: { userId_workId: { userId, workId } },
    create: { userId, workId },
    update: {},
  });
  revalidatePath("/dashboard");
}

export async function unsaveWork(workId: string) {
  const userId = await requireUser();
  await prisma.savedWork.deleteMany({ where: { userId, workId } });
  revalidatePath("/dashboard");
}

export async function isWorkSaved(workId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const row = await prisma.savedWork.findUnique({
    where: { userId_workId: { userId: session.user.id, workId } },
    select: { id: true },
  });
  return row != null;
}

export async function getSavedWorks() {
  const userId = await requireUser();
  return prisma.savedWork.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      work: {
        select: {
          id: true, slug: true, title: true, type: true,
          posterUrl: true, year: true, genre: true,
        },
      },
    },
  });
}
