"use server";
// Server Actions for register, login, and password reset
// Called directly from form components — no API route needed

import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { randomBytes, randomInt, createHash } from "crypto";
import { cookies } from "next/headers";
import { sendPasswordResetCodeEmail, sendSecurityAlertEmail } from "@/lib/email";
import { ensureWelcomeForUser } from "@/lib/onboarding/welcome";
import { trackEvent, getOrCreateSession } from "@/lib/analytics";
import { writeSecurityEvent, createSecurityAlert } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";

// ── Register ──────────────────────────────────────────────────
export async function registerUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  // Basic validation
  if (!email || !password || password.length < 8) {
    redirect("/register?error=" + encodeURIComponent("Please provide a valid email and a password of at least 8 characters."));
  }

  // Throttle scripted signup floods — each success creates/updates a User and can send
  // a welcome email (a spam-cannon + Graph-quota risk). Per hashed IP; raw IP never stored.
  const regIpRl = rateLimit(`register-ip:${await getClientIpHash()}`, 5, 60 * 60 * 1000);
  if (!regIpRl.allowed) {
    redirect("/register?error=" + encodeURIComponent("Too many sign-up attempts. Please try again later."));
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true },
  });

  if (existing) {
    if (existing.password) {
      // User already has a credentials account — cannot re-register
      redirect("/register?error=" + encodeURIComponent("An account with this email already exists."));
    }

    // Google-only user (no password) — add a password to their existing account.
    // This preserves their watch history, saved works, and notifications.
    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hashed,
        // Update name only if the user provided one and none exists
        ...(name?.trim() ? { name: name.trim() } : {}),
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
            userId: existing.id,
            sessionId,
            type: "SIGN_UP",
            metadata: { method: "credentials", linkedGoogle: "true" } as Record<string, string>,
          });
        }
      } catch { /* analytics must never break registration */ }
    })();

    // Await welcome before signIn — signIn throws NEXT_REDIRECT which abandons
    // any in-flight fire-and-forget promises before Graph can send the email.
    await ensureWelcomeForUser(existing.id).catch(() => {});

    // Auto-login with new credentials
    await signIn("credentials", { email, password, redirectTo: "/" });
    return; // signIn throws NEXT_REDIRECT — this line is a safety net
  }

  // Registrations kill-switch — enforced server-side for NEW accounts. Previously the
  // admin toggle only hid the nav link; /register and this action still worked when off.
  const settings = await prisma.adminSettings.findUnique({
    where: { id: "singleton" }, select: { allowNewRegistrations: true },
  });
  if (settings && !settings.allowNewRegistrations) {
    redirect("/register?error=" + encodeURIComponent("New registrations are currently closed."));
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

  // Await welcome before signIn — signIn throws NEXT_REDIRECT which abandons
  // any in-flight fire-and-forget promises before Graph can send the email.
  await ensureWelcomeForUser(newUser.id).catch(() => {});

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

  // Throttle BEFORE any DB/email work: caps reset-email bombing, reset-flow DoS (each
  // request deletes the victim's prior code), and the pool of live codes an attacker
  // can spray against. On limit, take the SAME neutral redirect as success so the limit
  // is invisible and enumeration stays impossible.
  const fpIpHash = await getClientIpHash();
  const fpEmailRl = rateLimit(`forgot:${email}`, 3, 60 * 60 * 1000);   // 3/hr per email
  const fpIpRl    = rateLimit(`forgot-ip:${fpIpHash}`, 15, 60 * 60 * 1000); // 15/hr per IP
  if (!fpEmailRl.allowed || !fpIpRl.allowed) {
    void writeSecurityEvent({
      type: "PASSWORD_RESET_REQUESTED", severity: "MEDIUM", email, ipHash: fpIpHash,
      metadata: { rateLimited: true, by: !fpEmailRl.allowed ? "email" : "ip" },
    });
    redirect(`/reset-password?email=${encodeURIComponent(email)}`);
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

    // Generate cryptographically random 6-digit code (100000–999999)
    const code = String(randomInt(100000, 1000000));
    const tokenHash = createHash("sha256").update(code).digest("hex");

    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordResetToken.create({
      data: { tokenHash, email, expires },
    });

    // Await the email — fire-and-forget was causing Vercel serverless to exit
    // at the redirect() before sendViaGraph completed, resulting in tokens
    // created but emails never sent (no log entry at all).
    // Errors are swallowed so the neutral success response is preserved
    // (same page shown whether the user exists or not — prevents enumeration).
    try {
      await sendPasswordResetCodeEmail(email, code);
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

  // Always redirect to the reset page with the email pre-filled.
  // Anti-enumeration preserved: same redirect whether the user exists or not.
  redirect(`/reset-password?email=${encodeURIComponent(email)}`);
}

// ── Verify Reset Code (Step 2) ─────────────────────────────────
// Checks if a 6-digit code is valid without marking it used.
// Returns a result object — does NOT redirect.
// The code is re-validated on final password submission for safety.
export async function verifyResetCode(
  _prev: { valid: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ valid: boolean; error?: string }> {
  const code  = (formData.get("code") as string)?.trim();
  const email = (formData.get("email") as string)?.toLowerCase().trim();

  if (!code || !email || !/^\d{6}$/.test(code)) {
    return { valid: false, error: "Please enter a valid 6-digit code." };
  }

  // Cap code-guessing velocity per IP and per email — the 6-digit space is only
  // 900k wide, so without this an attacker could spray codes to hit a live one.
  const vIpHash = await getClientIpHash();
  const vIpRl    = rateLimit(`reset-ip:${vIpHash}`, 12, 15 * 60 * 1000);
  const vEmailRl = rateLimit(`reset:${email}`, 12, 15 * 60 * 1000);
  if (!vIpRl.allowed || !vEmailRl.allowed) {
    void writeSecurityEvent({
      type: "PASSWORD_RESET_REQUESTED", severity: "HIGH", email, ipHash: vIpHash,
      metadata: { resetCodeGuessRateLimited: true },
    });
    return { valid: false, error: "Too many attempts. Please request a new code and try again shortly." };
  }

  const tokenHash = createHash("sha256").update(code).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  const isValid =
    record &&
    !record.used &&
    record.email === email &&
    record.expires > new Date();

  if (!isValid) {
    return { valid: false, error: "This code is invalid or has expired. Please request a new one." };
  }

  return { valid: true };
}

// ── Reset Password ─────────────────────────────────────────────
// Supports two flows:
//   1. Code flow (user-initiated): email + 6-digit code from email
//   2. Token flow (admin-initiated): long hex token from URL link
export async function resetPassword(formData: FormData) {
  const rawToken  = (formData.get("token") as string)?.trim();
  const code      = (formData.get("code") as string)?.trim();
  const email     = (formData.get("email") as string)?.toLowerCase().trim();
  const password  = (formData.get("password") as string);
  const confirm   = (formData.get("confirm") as string);

  // Determine which flow — code+email or legacy token
  const secret = code || rawToken;
  const isCodeFlow = !!code && !!email;

  if (!secret) {
    redirect("/forgot-password?error=" + encodeURIComponent("Invalid or missing reset code."));
  }

  // Build redirect-back URL for validation errors (preserves flow context)
  const errorRedirect = isCodeFlow
    ? `/reset-password?email=${encodeURIComponent(email!)}`
    : `/reset-password?token=${encodeURIComponent(rawToken!)}`;

  if (!password || password.length < 8) {
    redirect(
      `${errorRedirect}&error=` +
        encodeURIComponent("Password must be at least 8 characters.")
    );
  }

  if (password !== confirm) {
    redirect(
      `${errorRedirect}&error=` +
        encodeURIComponent("Passwords do not match.")
    );
  }

  // Rate-limit the CODE flow (6-digit, brute-forceable) per IP + email. The token flow
  // uses a 256-bit admin link and is not guessable, so it is exempt.
  const rpIpHash = await getClientIpHash();
  if (isCodeFlow) {
    const rpIpRl    = rateLimit(`reset-ip:${rpIpHash}`, 12, 15 * 60 * 1000);
    const rpEmailRl = rateLimit(`reset:${email}`, 12, 15 * 60 * 1000);
    if (!rpIpRl.allowed || !rpEmailRl.allowed) {
      void writeSecurityEvent({
        type: "PASSWORD_RESET_REQUESTED", severity: "HIGH", email, ipHash: rpIpHash,
        metadata: { resetCodeGuessRateLimited: true, stage: "submit" },
      });
      redirect(
        `${errorRedirect}&error=` +
          encodeURIComponent("Too many attempts. Please request a new code and try again shortly.")
      );
    }
  }

  const tokenHash = createHash("sha256").update(secret).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  // Valid iff: exists, unused, unexpired, AND (code flow) the code belongs to the
  // submitted email — binding the code to the email closes cross-account misuse.
  const isValid =
    record &&
    !record.used &&
    record.expires > new Date() &&
    (!isCodeFlow || record.email === email);

  if (!isValid) {
    // Make spraying visible so a flood of these is alertable, not silent.
    if (isCodeFlow) {
      void writeSecurityEvent({
        type: "PASSWORD_RESET_REQUESTED", severity: "MEDIUM", email, ipHash: rpIpHash,
        metadata: { invalidResetCode: true },
      });
    }
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent("This reset code is invalid or has expired. Please request a new one.")
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
        encodeURIComponent("This reset code is invalid or has expired. Please request a new one.")
    );
  }

  // Reject same-as-current password
  const sameAsOld = await bcrypt.compare(password, user.password);
  if (sameAsOld) {
    redirect(
      `${errorRedirect}&error=` +
        encodeURIComponent("New password cannot be the same as your current password.")
    );
  }

  const hashed = await bcrypt.hash(password, 12);

  // Update password, mark token used, and increment tokenVersion to invalidate
  // all existing sessions/JWTs — forces re-login on every device.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, tokenVersion: { increment: 1 } },
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

// ── Welcome-email magic link sign-in ─────────────────────────
// Called by the /welcome-login page's auto-submit form.
// Validates the HMAC token inside the credentials authorize callback.
export async function signInWithWelcomeToken(formData: FormData) {
  const uid   = (formData.get("uid")   as string)?.trim();
  const token = (formData.get("token") as string)?.trim();
  if (!uid || !token) {
    redirect("/login");
  }
  await signIn("credentials", { userId: uid, welcomeToken: token, redirectTo: "/dashboard" });
}
