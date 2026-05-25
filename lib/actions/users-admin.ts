"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import type { Role } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Unauthorized");
  return session.user;
}

// ── Change user role ──────────────────────────────────────────
// Bound pattern: changeUserRole.bind(null, userId) → (_prev, formData) => Promise<State>
export async function changeUserRole(
  userId: string,
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAdmin();
  const newRole = formData.get("role") as Role;

  if (!["USER", "ADMIN"].includes(newRole)) return { ok: false, error: "Invalid role." };
  if (userId === actor.id) return { ok: false, error: "You cannot change your own role." };

  // If demoting to USER, ensure at least one other ADMIN will remain
  if (newRole === "USER") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return { ok: false, error: "Cannot demote the last admin." };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Send password reset email (admin-initiated) ───────────────
// 24-hour expiry (vs 30m for user-initiated) since admin requested it.
export async function sendPasswordResetToUser(
  userId: string,
  _prev: { ok: boolean; message: string } | null,
  _fd: FormData
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, password: true },
  });

  if (!user) return { ok: false, message: "User not found." };
  if (!user.password) return { ok: false, message: "User has no credentials account." };

  // Invalidate any existing unused tokens
  await prisma.passwordResetToken.deleteMany({
    where: { email: user.email, used: false },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.passwordResetToken.create({
    data: { tokenHash, email: user.email, expires },
  });

  try {
    await sendPasswordResetEmail(user.email, rawToken);
    return { ok: true, message: `Reset email sent to ${user.email}` };
  } catch {
    return { ok: false, message: "Failed to send email. Check email config." };
  }
}
