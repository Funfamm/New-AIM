"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/** Fetch up to 10 notifications for the current user (unread first, then recent). */
export async function getUserNotifications() {
  const userId = await requireUser();
  const now = new Date();

  return prisma.notification.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      read: true,
      createdAt: true,
    },
    orderBy: [{ read: "asc" }, { createdAt: "desc" }],
    take: 10,
  });
}

/** Count unread notifications for the current user. */
export async function getUnreadNotificationCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  const now = new Date();

  return prisma.notification.count({
    where: {
      userId: session.user.id,
      read: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
}

/** Mark a single notification as read. */
export async function markNotificationRead(notificationId: string) {
  const userId = await requireUser();

  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}

/** Mark all notifications for the current user as read. */
export async function markAllNotificationsRead() {
  const userId = await requireUser();

  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
}
