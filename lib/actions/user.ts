"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateDisplayName } from "@/lib/signup-guard";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/**
 * Fetch the current user's live profile from the database.
 * Always reflects the latest DB state — never the stale JWT session.
 */
export async function getUserProfile() {
  const session = await auth();
  if (!session?.user?.id) return { name: null as string | null, email: null as string | null };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  return {
    name:  user?.name  ?? null,
    email: user?.email ?? session.user.email ?? null,
  };
}

/** Returns whether the current user has a password set (false = Google-only). */
export async function getUserPasswordState(): Promise<{ hasPassword: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { hasPassword: false };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  return { hasPassword: !!user?.password };
}

/** Update the current user's display name. */
export async function updateUserProfile(formData: FormData) {
  const userId = await requireUser();
  // Same rule as sign-up: a display name is a name — no links, markup or symbols.
  const nameCheck = validateDisplayName(formData.get("name"));
  if (!nameCheck.ok) {
    redirect("/dashboard/settings?error=" + encodeURIComponent(nameCheck.error));
  }
  const name = nameCheck.name;

  await prisma.user.update({
    where: { id: userId },
    data: { name },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  // Redirect back with ?saved=profile so the Saved chip appears.
  // The page reads name from DB (getUserProfile), so the updated value shows immediately.
  redirect("/dashboard/settings?saved=profile");
}
