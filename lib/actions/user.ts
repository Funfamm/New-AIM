"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/** Update the current user's display name. */
export async function updateUserProfile(formData: FormData) {
  const userId = await requireUser();
  const name = (formData.get("name") as string | null)?.trim() || null;

  if (name && name.length > 80) {
    redirect("/dashboard/settings?error=Name+is+too+long");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { name },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=profile");
}
