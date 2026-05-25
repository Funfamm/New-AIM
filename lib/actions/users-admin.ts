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

// ── Suspend a single user ─────────────────────────────────────
export async function suspendUser(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAdmin();

  if (userId === actor.id) return { ok: false, error: "You cannot suspend your own account." };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.status === "SUSPENDED") return { ok: false, error: "User is already suspended." };

  // Prevent suspending the last active admin
  if (target.role === "ADMIN") {
    const activeAdminCount = await prisma.user.count({
      where: { role: "ADMIN", status: "ACTIVE" },
    });
    if (activeAdminCount <= 1) {
      return { ok: false, error: "Cannot suspend the last active admin." };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedBy: actor.id },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Unsuspend a single user ───────────────────────────────────
export async function unsuspendUser(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", suspendedAt: null, suspendedBy: null },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Bulk suspend ──────────────────────────────────────────────
// Safety rules applied server-side:
//   - Self is always excluded
//   - If only 1 active admin remains, admin accounts in the batch are skipped
//   - Non-admin users are always processed
export async function bulkSuspend(userIds: string[]): Promise<void> {
  const actor = await requireAdmin();
  if (userIds.length === 0) return;

  // Always exclude self
  const candidateIds = userIds.filter((id) => id !== actor.id);
  if (candidateIds.length === 0) return;

  // Determine which candidates are admins
  const adminTargets = await prisma.user.findMany({
    where: { id: { in: candidateIds }, role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  const adminIdSet = new Set(adminTargets.map((u) => u.id));
  const nonAdminIds = candidateIds.filter((id) => !adminIdSet.has(id));

  let adminIdsToSuspend: string[] = [];
  if (adminIdSet.size > 0) {
    const activeAdminCount = await prisma.user.count({
      where: { role: "ADMIN", status: "ACTIVE" },
    });
    // Only suspend admin targets if enough active admins will remain
    if (activeAdminCount - adminIdSet.size >= 1) {
      adminIdsToSuspend = Array.from(adminIdSet);
    }
    // Otherwise skip all admin targets silently (non-admins still processed)
  }

  const finalIds = [...nonAdminIds, ...adminIdsToSuspend];
  if (finalIds.length === 0) return;

  await prisma.user.updateMany({
    where: { id: { in: finalIds }, status: "ACTIVE" },
    data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedBy: actor.id },
  });
  revalidatePath("/admin/users");
}

// ── Bulk unsuspend ────────────────────────────────────────────
export async function bulkUnsuspend(userIds: string[]): Promise<void> {
  await requireAdmin();
  if (userIds.length === 0) return;

  await prisma.user.updateMany({
    where: { id: { in: userIds }, status: "SUSPENDED" },
    data: { status: "ACTIVE", suspendedAt: null, suspendedBy: null },
  });
  revalidatePath("/admin/users");
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
