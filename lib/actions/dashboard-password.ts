"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { randomInt, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { sendPasswordResetCodeEmail, sendSecurityAlertEmail } from "@/lib/email";
import { writeSecurityEvent, createSecurityAlert } from "@/lib/security";

async function requireSessionEmail(): Promise<{ userId: string; email: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new Error("Not authenticated");
  }
  return { userId: session.user.id, email: session.user.email.toLowerCase().trim() };
}

async function isRateLimited(email: string): Promise<boolean> {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const count = await prisma.passwordResetToken.count({
    where: { email, createdAt: { gte: since } },
  });
  return count >= 3;
}

// ── Step 1: Request code ──────────────────────────────────────
export async function requestDashboardPasswordCode(): Promise<{ ok: boolean; error?: string }> {
  const { userId, email } = await requireSessionEmail();

  if (await isRateLimited(email)) {
    return { ok: false, error: "Too many requests. Please wait a few minutes and try again." };
  }

  await prisma.passwordResetToken.deleteMany({ where: { email, used: false } });

  const code = String(randomInt(100000, 1000000));
  const tokenHash = createHash("sha256").update(code).digest("hex");
  const expires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.passwordResetToken.create({ data: { tokenHash, email, expires } });

  try {
    await sendPasswordResetCodeEmail(email, code);
  } catch {
    return { ok: false, error: "Failed to send verification email. Please try again." };
  }

  void writeSecurityEvent({ userId, type: "PASSWORD_RESET_REQUESTED", severity: "LOW", email });

  return { ok: true };
}

// ── Step 2: Verify code ───────────────────────────────────────
export type PwdVerifyState = { verified: boolean; error?: string } | null;

export async function verifyDashboardPasswordCode(
  _prev: PwdVerifyState,
  formData: FormData,
): Promise<PwdVerifyState> {
  const { email } = await requireSessionEmail();
  const code = (formData.get("code") as string)?.trim();

  if (!code || !/^\d{6}$/.test(code)) {
    return { verified: false, error: "Please enter a valid 6-digit code." };
  }

  const tokenHash = createHash("sha256").update(code).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  const isValid =
    record && !record.used && record.email === email && record.expires > new Date();

  if (!isValid) {
    return { verified: false, error: "This code is invalid or has expired. Please request a new one." };
  }

  return { verified: true };
}

// ── Step 3a: Change existing password ────────────────────────
export type PwdChangeState = { ok: boolean; error?: string } | null;

export async function changeDashboardPassword(
  _prev: PwdChangeState,
  formData: FormData,
): Promise<PwdChangeState> {
  const { userId, email } = await requireSessionEmail();
  const code     = (formData.get("code") as string)?.trim();
  const current  = (formData.get("current") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const confirm  = (formData.get("confirm") as string) ?? "";

  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords do not match." };
  }

  if (!code || !/^\d{6}$/.test(code)) {
    return { ok: false, error: "Invalid verification code. Please start over." };
  }

  const tokenHash = createHash("sha256").update(code).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.used || record.email !== email || record.expires <= new Date()) {
    return { ok: false, error: "Your verification code expired. Please start over." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user?.password) {
    return { ok: false, error: "No password set on this account." };
  }

  const currentMatch = await bcrypt.compare(current, user.password);
  if (!currentMatch) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const sameAsOld = await bcrypt.compare(password, user.password);
  if (sameAsOld) {
    return { ok: false, error: "New password cannot be the same as your current password." };
  }

  const hashed = await bcrypt.hash(password, 12);

  // Intentionally do NOT increment tokenVersion — user stays logged in on all devices.
  // Security alert fires regardless.
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { tokenHash }, data: { used: true } }),
  ]);

  void writeSecurityEvent({ userId, type: "PASSWORD_CHANGED", severity: "MEDIUM", email });
  void createSecurityAlert({
    userId,
    severity: "MEDIUM",
    type: "PASSWORD_CHANGED",
    title: "Your password was changed",
    message:
      "Your AIM Studio password was changed from your account settings. If you did not make this change, reset your password immediately.",
  });
  void sendSecurityAlertEmail({
    to: email,
    title: "Your password was changed",
    body: "Your AIM Studio password was changed from your account settings. If you did not make this change, reset your password immediately.",
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/forgot-password`,
    actionLabel: "Reset Password",
  }).catch(() => {});

  return { ok: true };
}

// ── Step 3b: Create first password (Google-only user) ─────────
export async function createDashboardPassword(
  _prev: PwdChangeState,
  formData: FormData,
): Promise<PwdChangeState> {
  const { userId, email } = await requireSessionEmail();
  const code     = (formData.get("code") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";
  const confirm  = (formData.get("confirm") as string) ?? "";

  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords do not match." };
  }

  if (!code || !/^\d{6}$/.test(code)) {
    return { ok: false, error: "Invalid verification code. Please start over." };
  }

  const tokenHash = createHash("sha256").update(code).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.used || record.email !== email || record.expires <= new Date()) {
    return { ok: false, error: "Your verification code expired. Please start over." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (user?.password) {
    return { ok: false, error: "Password already set. Use Change password instead." };
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { tokenHash }, data: { used: true } }),
  ]);

  void writeSecurityEvent({ userId, type: "PASSWORD_RESET_COMPLETED", severity: "MEDIUM", email });
  void createSecurityAlert({
    userId,
    severity: "MEDIUM",
    type: "PASSWORD_RESET_COMPLETED",
    title: "A password was added to your account",
    message:
      "A password was added to your AIM Studio account from Settings. You can now sign in with your email and password.",
  });
  void sendSecurityAlertEmail({
    to: email,
    title: "A password was added to your account",
    body: "A password was added to your AIM Studio account. You can now sign in with your email and password.",
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    actionLabel: "Sign In",
  }).catch(() => {});

  return { ok: true };
}
