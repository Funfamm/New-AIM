"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Unauthorized");
  return session.user;
}

/** Mark a SecurityAlert as RESOLVED. */
export async function resolveAlert(alertId: string): Promise<void> {
  await requireAdmin();
  await prisma.securityAlert.update({
    where: { id: alertId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  revalidatePath("/admin/security");
}

/** Mark a SecurityAlert as DISMISSED. */
export async function dismissAlert(alertId: string): Promise<void> {
  await requireAdmin();
  await prisma.securityAlert.update({
    where: { id: alertId },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
  revalidatePath("/admin/security");
}
