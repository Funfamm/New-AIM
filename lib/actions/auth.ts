"use server";
// Server Actions for register, login, and password reset
// Called directly from form components — no API route needed

import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { sendPasswordResetEmail, sendSecurityAlertEmail } from "@/lib/email";
import { ensureWelcomeForUser } from "@/lib/onboarding/welcome";
import { trackEvent, getOrCreateSession } from "@/lib/analytics";
import { writeSecurityEvent, createSecurityAlert } from "@/lib/security";

// ── Register ──────────────────────────────────────────────────
export async function registerUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  // Basic validation
  if (!email || !password || password.length < 8) {
    redirect("/register?error=" + encodeURIComponent("Please provide a valid email and a password of at least 8 characters."));
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/register?error=" + encodeURIComponent("An account with this email already exists."));
  }

  // Hash password — 12 rounds is secure without being slow
  const hashed = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      name: name?.trim() || null,
      email,
      password: hashed,
      role: "USER",
    },
  });

  // Track sign-up event — fire-and-forget, never throws
  void (async () => {
    try {
      const jar = await cookies();
      const visitorId = jar.get("aim-vid")?.value;
      if (visitorId) {
        const sessionId = await getOrCreateSession({ visitorId }).catch(() => undefined);
        await trackEvent({
          visitorId,
          userId: newUser.id,
          sessionId,
          type: "SIGN_UP",
          metadata: { method: "credentials" } as Record<string, string>,
        });
      }
    } catch { /* analytics must never break registration */ }
  })();

  // Welcome email + in-app notification — fire-and-forget, never blocks auth
  void ensureWelcomeForUser(newUser.id).catch(() => {});

  // Auto-login after register
  await signIn("credentials", { email, password, redirectTo: "/" });
}

// ── Login ─────────────────────────────────────────────────────
export async function loginUser(formData: FormData) {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;
  const from = (formData.get("from") as string) || "/";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: from,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      const fromParam = from !== "/" ? `&from=${encodeURIComponent(from)}` : "";
      redirect("/login?error=" + encodeURIComponent("Invalid email or password.") + fromParam);
    }
    throw err; // re-throw redirect, etc.
  }
}

// ── Logout ────────────────────────────────────────────────────
export async function logoutUser() {
  // Track sign-out before the session is destroyed — fire-and-forget
  void (async () => {
    try {
      const jar = await cookies();
      const visitorId = jar.get("aim-vid")?.value;
      if (visitorId) {
        await trackEvent({ visitorId, type: "SIGN_OUT" });
      }
    } catch { /* analytics must never block logout */ }
  })();

  await signOut({ redirectTo: "/" });
}

// ── Google OAuth ───────────────────────────────────────────────
export async function signInWithGoogle(formData: FormData) {
  const redirectTo = (formData.get("redirectTo") as string) || "/";
  await signIn("google", { redirectTo });
}

// ── Forgot Password ────────────────────────────────────────────
// Always redirects to a neutral success page regardless of whether the email exists.
// This prevents user enumeration.
export async function forgotPassword(formData: FormData) {
  const email = (formData.get("email") as string)?.toLowerCase().trim();

  if (!email) {
    redirect("/forgot-password?error=" + encodeURIComponent("Please enter a valid email address."));
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true },
  });

  // Only send a reset link if: user exists AND has a password (credentials account)
  // Google-only users: silently skip — neutral response is shown regardless
  if (user?.password) {
    // Invalidate any existing unused tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email, used: false },
    });

    // Generate cryptographically random token (32 bytes → 64 hex chars)
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.passwordResetToken.create({
      data: { tokenHash, email, expires },
    });

    // Await the email — fire-and-forget was causing Vercel serverless to exit
    // at the redirect() before sendViaGraph completed, resulting in tokens
    // created but emails never sent (no log entry at all).
    // Errors are swallowed so the neutral success response is preserved
    // (same page shown whether the user exists or not — prevents enumeration).
    try {
      await sendPasswordResetEmail(email, rawToken);
    } catch {
      // sendEmail already wrote a FAILED log entry with the error detail.
      // Silently continue — user sees the neutral success page regardless.
    }

    // Security event — fire-and-forget (non-critical, must not block redirect)
    void writeSecurityEvent({
      userId: user.id, type: "PASSWORD_RESET_REQUESTED", severity: "LOW",
      email,
    });
  }

  // Always redirect to the same success page
  redirect("/forgot-password?sent=1");
}

// ── Reset Password ─────────────────────────────────────────────
export async function resetPassword(formData: FormData) {
  const rawToken  = (formData.get("token") as string)?.trim();
  const password  = (formData.get("password") as string);
  const confirm   = (formData.get("confirm") as string);

  if (!rawToken) {
    redirect("/forgot-password?error=" + encodeURIComponent("Invalid or missing reset token."));
  }

  if (!password || password.length < 8) {
    redirect(
      `/reset-password?token=${encodeURIComponent(rawToken)}&error=` +
        encodeURIComponent("Password must be at least 8 characters.")
    );
  }

  if (password !== confirm) {
    redirect(
      `/reset-password?token=${encodeURIComponent(rawToken)}&error=` +
        encodeURIComponent("Passwords do not match.")
    );
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  // Token not found, already used, or expired — all get the same generic error
  const isValid =
    record &&
    !record.used &&
    record.expires > new Date();

  if (!isValid) {
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent("This reset link is invalid or has expired. Please request a new one.")
    );
  }

  // Find the user — must have a password (credentials account)
  const user = await prisma.user.findUnique({
    where: { email: record.email },
    select: { id: true, password: true },
  });

  if (!user?.password) {
    // Google-only user or non-existent — same neutral error
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent("This reset link is invalid or has expired. Please request a new one.")
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  // Update password and mark token used in a transaction
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    }),
    prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { used: true },
    }),
  ]);

  // Security events + user alert — fire-and-forget
  void writeSecurityEvent({
    userId: user.id, type: "PASSWORD_RESET_COMPLETED", severity: "MEDIUM",
    email: record.email,
  });
  void createSecurityAlert({
    userId: user.id, severity: "MEDIUM",
    type: "PASSWORD_RESET_COMPLETED",
    title: "Your password was changed",
    message: "Your AIM Studio password was successfully reset. If you did not make this change, contact support immediately.",
  });
  void sendSecurityAlertEmail({
    to:    record.email,
    title: "Your password was changed",
    body:  "Your AIM Studio password was successfully reset. If you did not make this change, reset your password again immediately.",
    actionUrl:   `${process.env.NEXT_PUBLIC_APP_URL}/forgot-password`,
    actionLabel: "Reset Again",
  }).catch(() => {});

  redirect("/login?success=" + encodeURIComponent("Password updated. Please sign in with your new password."));
}
