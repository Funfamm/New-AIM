"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import { writeSecurityEvent, createSecurityAlert } from "@/lib/security";
import type { Role } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Unauthorized");
  return session.user;
}

// ── Change user role ──────────────────────────────────────────
export async function changeUserRole(
  userId: string,
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAdmin();
  const newRole = formData.get("role") as Role;

  if (!["USER", "ADMIN"].includes(newRole)) return { ok: false, error: "Invalid role." };
  if (userId === actor.id) return { ok: false, error: "You cannot change your own role." };

  // Fetch target for safety check + audit snapshot
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === newRole) { revalidatePath("/admin/users"); return { ok: true }; }

  // Guard: demoting the last admin
  if (newRole === "USER" && target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { ok: false, error: "Cannot demote the last admin." };
  }

  await prisma.user.update({ where: { id: userId }, data: { role: newRole } });

  void writeAudit({
    actorId:    actor.id!,
    actorEmail: actor.email ?? "unknown",
    targetId:   userId,
    targetEmail: target.email,
    action:     "ROLE_CHANGE",
    detail:     `${target.role} → ${newRole}`,
  });
  void writeSecurityEvent({
    userId: userId, actorUserId: actor.id,
    type: "ROLE_CHANGED", severity: "HIGH",
    email: target.email,
    metadata: { from: target.role, to: newRole },
  });

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
    select: { role: true, status: true, email: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.status === "SUSPENDED") return { ok: false, error: "User is already suspended." };

  if (target.role === "ADMIN") {
    const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (activeAdminCount <= 1) return { ok: false, error: "Cannot suspend the last active admin." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedBy: actor.id },
  });

  void writeAudit({
    actorId:     actor.id!,
    actorEmail:  actor.email ?? "unknown",
    targetId:    userId,
    targetEmail: target.email,
    action:      "SUSPEND",
  });
  void writeSecurityEvent({
    userId: userId, actorUserId: actor.id,
    type: "USER_SUSPENDED", severity: "MEDIUM",
    email: target.email,
  });
  void createSecurityAlert({
    userId, severity: "MEDIUM",
    type: "USER_SUSPENDED",
    title: "Your account has been suspended",
    message: "Your AIM Studio account has been temporarily suspended. Contact support if you believe this is an error.",
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Unsuspend a single user ───────────────────────────────────
export async function unsuspendUser(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAdmin();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", suspendedAt: null, suspendedBy: null },
  });

  void writeAudit({
    actorId:     actor.id!,
    actorEmail:  actor.email ?? "unknown",
    targetId:    userId,
    targetEmail: target?.email,
    action:      "UNSUSPEND",
  });
  void writeSecurityEvent({
    userId: userId, actorUserId: actor.id,
    type: "USER_UNSUSPENDED", severity: "INFO",
    email: target?.email,
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Bulk suspend ──────────────────────────────────────────────
export async function bulkSuspend(userIds: string[]): Promise<void> {
  const actor = await requireAdmin();
  if (userIds.length === 0) return;

  const candidateIds = userIds.filter((id) => id !== actor.id);
  if (candidateIds.length === 0) return;

  const adminTargets = await prisma.user.findMany({
    where: { id: { in: candidateIds }, role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  const adminIdSet = new Set(adminTargets.map((u) => u.id));
  const nonAdminIds = candidateIds.filter((id) => !adminIdSet.has(id));

  let adminIdsToSuspend: string[] = [];
  if (adminIdSet.size > 0) {
    const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (activeAdminCount - adminIdSet.size >= 1) {
      adminIdsToSuspend = Array.from(adminIdSet);
    }
  }

  const finalIds = [...nonAdminIds, ...adminIdsToSuspend];
  if (finalIds.length === 0) return;

  const result = await prisma.user.updateMany({
    where: { id: { in: finalIds }, status: "ACTIVE" },
    data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedBy: actor.id },
  });

  void writeAudit({
    actorId:    actor.id!,
    actorEmail: actor.email ?? "unknown",
    action:     "BULK_SUSPEND",
    detail:     `${result.count} user${result.count !== 1 ? "s" : ""} suspended`,
  });

  revalidatePath("/admin/users");
}

// ── Bulk unsuspend ────────────────────────────────────────────
export async function bulkUnsuspend(userIds: string[]): Promise<void> {
  const actor = await requireAdmin();
  if (userIds.length === 0) return;

  const result = await prisma.user.updateMany({
    where: { id: { in: userIds }, status: "SUSPENDED" },
    data: { status: "ACTIVE", suspendedAt: null, suspendedBy: null },
  });

  void writeAudit({
    actorId:    actor.id!,
    actorEmail: actor.email ?? "unknown",
    action:     "BULK_UNSUSPEND",
    detail:     `${result.count} user${result.count !== 1 ? "s" : ""} unsuspended`,
  });

  revalidatePath("/admin/users");
}

// ── Send password reset email (admin-initiated) ───────────────
export async function sendPasswordResetToUser(
  userId: string,
  _prev: { ok: boolean; message: string } | null,
  _fd: FormData
): Promise<{ ok: boolean; message: string }> {
  const actor = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, password: true },
  });

  if (!user) return { ok: false, message: "User not found." };
  if (!user.password) return { ok: false, message: "User has no credentials account." };

  await prisma.passwordResetToken.deleteMany({ where: { email: user.email, used: false } });

  const rawToken  = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expires   = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await prisma.passwordResetToken.create({ data: { tokenHash, email: user.email, expires } });

  try {
    await sendPasswordResetEmail(user.email, rawToken);

    void writeAudit({
      actorId:     actor.id!,
      actorEmail:  actor.email ?? "unknown",
      targetId:    userId,
      targetEmail: user.email,
      action:      "PASSWORD_RESET_SENT",
    });

    return { ok: true, message: `Reset email sent to ${user.email}` };
  } catch {
    return { ok: false, message: "Failed to send email. Check email config." };
  }
}

// ── Deactivate (soft-delete) ──────────────────────────────────
// Status → DEACTIVATED. Records preserved. Admin can restore.
export async function deactivateUser(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAdmin();

  if (userId === actor.id) return { ok: false, error: "You cannot deactivate your own account." };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, email: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.status === "DEACTIVATED") return { ok: false, error: "User is already deactivated." };

  if (target.role === "ADMIN") {
    const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (activeAdminCount <= 1) return { ok: false, error: "Cannot deactivate the last active admin." };
  }

  await prisma.user.update({
    where: { id: userId },
    data:  { status: "DEACTIVATED", deletedAt: new Date(), deletedById: actor.id },
  });

  void writeAudit({
    actorId:     actor.id!,
    actorEmail:  actor.email ?? "unknown",
    targetId:    userId,
    targetEmail: target.email,
    action:      "DEACTIVATE",
  });
  void writeSecurityEvent({
    userId: userId, actorUserId: actor.id,
    type: "USER_DEACTIVATED", severity: "HIGH",
    email: target.email,
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Restore deactivated user ──────────────────────────────────
export async function restoreUser(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAdmin();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, email: true },
  });
  if (!target) return { ok: false, error: "User not found." };
  if (target.status !== "DEACTIVATED") return { ok: false, error: "User is not deactivated." };

  await prisma.user.update({
    where: { id: userId },
    data:  { status: "ACTIVE", deletedAt: null, deletedById: null },
  });

  void writeAudit({
    actorId:     actor.id!,
    actorEmail:  actor.email ?? "unknown",
    targetId:    userId,
    targetEmail: target.email,
    action:      "RESTORE",
  });
  void writeSecurityEvent({
    userId: userId, actorUserId: actor.id,
    type: "USER_RESTORED", severity: "INFO",
    email: target.email,
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Purge user (hard delete) ──────────────────────────────────
// Permanently removes or anonymizes all user data.
// Requires: admin actor, confirmation phrase, cannot purge self or last admin.
// Keeps a minimal SecurityEvent record for accountability.
export async function purgeUser(
  userId: string,
  confirmationPhrase: string
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireAdmin();

  if (confirmationPhrase !== "PURGE USER") {
    return { ok: false, error: "Incorrect confirmation phrase. Type PURGE USER to confirm." };
  }
  if (userId === actor.id) {
    return { ok: false, error: "You cannot purge your own account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true, status: true },
  });
  if (!target) return { ok: false, error: "User not found." };

  // Guard: cannot purge the last admin
  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { ok: false, error: "Cannot purge the last admin account." };
  }

  const emailSnapshot = target.email; // capture before deletion

  // ── Hard delete in dependency order ───────────────────────────
  // Each delete is wrapped to allow partial success logging
  await prisma.$transaction(async (tx) => {
    // 1. Clear Auth.js linked accounts + sessions
    await tx.account.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });

    // 2. Clear password reset tokens
    await tx.passwordResetToken.deleteMany({ where: { email: emailSnapshot } });

    // 3. Clear user content/activity
    await tx.watchProgress.deleteMany({ where: { userId } });
    await tx.savedWork.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.userPreferences.deleteMany({ where: { userId } });

    // 4. Anonymize analytics events — preserve counts, remove identity
    // userId is plain string on AnalyticsEvent — update to null
    await tx.analyticsEvent.updateMany({
      where: { userId },
      data:  { userId: null },
    });
    // VisitorSession.userId is also plain — anonymize
    await tx.visitorSession.updateMany({
      where: { userId },
      data:  { userId: null },
    });

    // 5. Remove device records
    await tx.userDevice.deleteMany({ where: { userId } });

    // 6. Resolve open security alerts
    await tx.securityAlert.updateMany({
      where:  { userId, status: "OPEN" },
      data:   { status: "RESOLVED", resolvedAt: new Date() },
    });

    // 7. Delete the user record
    await tx.user.delete({ where: { id: userId } });
  });

  // Minimal immutable audit record — no PII, just accountability
  void writeAudit({
    actorId:    actor.id!,
    actorEmail: actor.email ?? "unknown",
    targetId:   userId,      // ID only — email removed
    action:     "PURGE",
    detail:     "User permanently purged. All PII removed.",
  });

  // Security event — uses email snapshot since user row is gone
  void writeSecurityEvent({
    actorUserId: actor.id,
    type:        "USER_PURGED",
    severity:    "CRITICAL",
    metadata:    { targetId: userId, purgedBy: actor.id },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
