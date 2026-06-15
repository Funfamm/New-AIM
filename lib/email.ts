// Email sending module — isolated so the provider can be swapped without touching callsites.
// Priority: Microsoft Graph (Azure) → DEV console log fallback
// SMTP stub ready for future approval.
// No tracking pixels. Transactional only.

import { prisma } from "@/lib/prisma";
import { premiumTransactionalEmail } from "@/lib/email-base";
import { generateTrackingToken, injectTrackingPixel, wrapLinksWithTracking } from "@/lib/email-tracking";
import type { EmailType, EmailProvider, Prisma } from "@prisma/client";

const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM_EMAIL = process.env.GRAPH_EMAIL_SENDER  ?? "noreply@example.com";
const FROM_NAME  = "AIM Studio";

// ── Types ─────────────────────────────────────────────────────

type SendOptions = {
  to:       string;
  subject:  string;
  html:     string;
  type:     EmailType;
  metadata?: Record<string, unknown>;
};

// ── Safety-critical email types ───────────────────────────────
// These types must NOT be blocked by marketing suppression.
// A user who unsubscribed from newsletters still needs to receive
// password resets and security alerts for account safety.
// Bulk/marketing emails (NEW_RELEASE, ANNOUNCEMENT, etc.) are routed
// through lib/bulk-email.ts and always respect suppression — correct.

const BYPASS_SUPPRESSION_TYPES = new Set<EmailType>([
  "PASSWORD_RESET",
  "SECURITY_ALERT",
  "ADMIN_ALERT",
  "ACCOUNT",
  "WELCOME", // transactional account confirmation — must not be blocked by marketing suppression
]);

// ── Suppression check ─────────────────────────────────────────

async function isSuppressed(email: string): Promise<boolean> {
  try {
    const row = await prisma.emailSuppression.findUnique({
      where: { email: email.toLowerCase() },
      select: { active: true },
    });
    return row?.active === true;
  } catch {
    return false; // never block a send on suppression check failure
  }
}

// ── Email log writer ──────────────────────────────────────────

async function logEmail(opts: {
  to: string;
  subject: string;
  type: EmailType;
  provider: EmailProvider;
  status: "SENT" | "FAILED" | "SUPPRESSED";
  error?: string;
  metadata?: Record<string, unknown>;
  trackingToken?: string;
}): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        to:            opts.to,
        from:          FROM_EMAIL,
        subject:       opts.subject,
        type:          opts.type,
        provider:      opts.provider,
        status:        opts.status,
        error:         opts.error ?? null,
        metadata:      opts.metadata != null ? (opts.metadata as Prisma.InputJsonValue) : undefined,
        trackingToken: opts.trackingToken ?? null,
        sentAt:        opts.status === "SENT" ? new Date() : null,
      },
    });
  } catch {
    // logging must never throw or block the caller
  }
}

// ── Microsoft Graph sender ─────────────────────────────────────

async function sendViaGraph(to: string, subject: string, html: string): Promise<void> {
  const clientId     = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId     = process.env.AZURE_TENANT_ID;
  const from         = process.env.GRAPH_EMAIL_SENDER;

  if (!clientId || !clientSecret || !tenantId || !from) {
    throw new Error("GRAPH_EMAIL_SENDER env vars incomplete");
  }

  // Acquire OAuth2 token from Azure AD
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!tokenRes.ok) {
    throw new Error(`Graph token request failed: ${tokenRes.status}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Send mail via Graph API
  const mailRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body:          { contentType: "HTML", content: html },
          toRecipients:  [{ emailAddress: { address: to } }],
          from:          { emailAddress: { address: from, name: FROM_NAME } },
        },
        saveToSentItems: false,
      }),
    }
  );

  if (!mailRes.ok) {
    const body = await mailRes.text();
    throw new Error(`Graph sendMail failed: ${mailRes.status} — ${body}`);
  }
}

// ── SMTP sender (stub — add nodemailer when approved) ──────────

// async function sendViaSMTP(to: string, subject: string, html: string): Promise<void> { ... }

// ── Dispatch ──────────────────────────────────────────────────

export async function sendEmail(opts: SendOptions): Promise<void> {
  const { to, subject, type, metadata } = opts;
  const toNorm = to.toLowerCase().trim();
  const isDev  = process.env.NODE_ENV !== "production";

  // Suppression check — bypass for account-safety types (password reset, security alerts).
  // Marketing unsubscribe must never prevent a user receiving their own reset link.
  // Bulk marketing emails (NEW_RELEASE, ANNOUNCEMENT, etc.) go through lib/bulk-email.ts
  // which always enforces suppression — this bypass only applies to transactional Graph sends.
  const bypassSuppression = BYPASS_SUPPRESSION_TYPES.has(type);

  if (!bypassSuppression && (await isSuppressed(toNorm))) {
    await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "SUPPRESSED" });
    return;
  }

  const trackingToken = generateTrackingToken();
  const html = injectTrackingPixel(wrapLinksWithTracking(opts.html, trackingToken), trackingToken);

  const graphConfigured =
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.GRAPH_EMAIL_SENDER;

  // Production: must use Graph — hard fail if not configured
  if (!isDev) {
    try {
      await sendViaGraph(toNorm, subject, html);
      await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "SENT", metadata, trackingToken });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "FAILED", error, metadata, trackingToken });
      throw err; // re-throw so callers can decide whether to surface the error
    }
    return;
  }

  // Dev: try Graph if configured, otherwise log to console only
  if (graphConfigured) {
    try {
      await sendViaGraph(toNorm, subject, html);
      await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "SENT", metadata, trackingToken });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await logEmail({ to: toNorm, subject, type, provider: "GRAPH", status: "FAILED", error, metadata, trackingToken });
      throw err;
    }
    return;
  }

  // DEV ONLY — log to console, never runs in production
  console.log("\n[DEV ONLY — EMAIL NOT SENT]");
  console.log(`To:      ${toNorm}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:    ${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
  console.log("[END DEV EMAIL]\n");
  await logEmail({ to: toNorm, subject, type, provider: "DEV_LOG", status: "SENT", metadata, trackingToken });
}

// ── HTML helpers ──────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function btn(label: string, href: string): string {
  return `<a href="${href}"
     style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
            letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
    ${label}
  </a>`;
}

function ghostBtn(label: string, href: string): string {
  return `<a href="${href}"
     style="display:inline-block;color:#e5e7eb;font-size:13px;font-weight:500;
            text-decoration:none;padding:12px 20px;border:1px solid #3a3a3a;border-radius:3px;">
    ${label}
  </a>`;
}

function bodyP(text: string): string {
  return `<p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.7;">${text}</p>`;
}

function noteP(text: string): string {
  return `<p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">${text}</p>`;
}

// ── Password reset ─────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
  // rawToken is never logged — only the URL is used here and only in the email body

  const bodyHtml = `
    ${bodyP("We received a request to reset the password for your AIM Studio account. Click the button below to choose a new password. <strong style='color:#e5e7eb;'>This link expires in 30 minutes.</strong>")}
    ${btn("Reset Password", resetUrl)}
    ${noteP("If you did not request a password reset, you can safely ignore this email.")}
    ${noteP("Do not share this link with anyone. AIM Studio will never ask for your password.")}
    ${noteP(`If the button doesn&rsquo;t work, copy this link:<br><span style="color:#9ca3af;word-break:break-all;font-size:11px;">${esc(resetUrl)}</span>`)}`;

  await sendEmail({
    to,
    subject: "Reset your AIM Studio password",
    html:    premiumTransactionalEmail({ title: "Reset your password", bodyHtml }),
    type:    "PASSWORD_RESET",
  });
}

// ── Password reset code (user-initiated) ──────────────────────

export async function sendPasswordResetCodeEmail(to: string, code: string): Promise<void> {
  const bodyHtml = `
    ${bodyP("We received a request to reset the password for your AIM Studio account. Enter the verification code below. <strong style='color:#e5e7eb;'>This code expires in 30 minutes.</strong>")}
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;background:#1a1a1a;border:2px solid #e8c97e;border-radius:6px;
                    padding:16px 36px;font-size:34px;font-weight:700;letter-spacing:10px;color:#f9fafb;
                    font-family:monospace;">
        ${esc(code)}
      </span>
    </div>
    ${noteP("If you did not request a password reset, you can safely ignore this email.")}
    ${noteP("Do not share this code with anyone.")}`;

  await sendEmail({
    to,
    subject: "Your AIM Studio password reset code",
    html:    premiumTransactionalEmail({ title: "Password reset code", bodyHtml }),
    type:    "PASSWORD_RESET",
  });
}

// ── Security alert email ───────────────────────────────────────

export async function sendSecurityAlertEmail(opts: {
  to: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
}): Promise<void> {
  const resetUrl = `${APP_URL}/forgot-password`;

  const actionHtml = opts.actionUrl
    ? `<div style="margin:20px 0 0;">${btn(opts.actionLabel ?? "Take Action", opts.actionUrl)}</div>`
    : "";

  const bodyHtml = `
    ${bodyP(esc(opts.body))}
    ${actionHtml}
    ${noteP(`If this was you, no action is needed.`)}
    ${noteP(`If this was <strong style="color:#e5e7eb;">not</strong> you, <a href="${resetUrl}" style="color:#f87171;">reset your password immediately</a>.`)}`;

  await sendEmail({
    to:      opts.to,
    subject: `Security alert — AIM Studio`,
    html:    premiumTransactionalEmail({ title: opts.title, bodyHtml, label: "Security Alert" }),
    type:    "SECURITY_ALERT",
  });
}

// ── Welcome email ──────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name?: string | null, userId?: string): Promise<void> {
  const firstName = name?.split(" ")[0] ?? null;
  const greeting  = firstName ? `Welcome, ${esc(firstName)}` : "Welcome to AIM Studio";

  // Build magic-link URL if we have a userId so the CTA logs the user in automatically.
  // Falls back to plain /dashboard (requires manual sign-in) if no userId is provided.
  let ctaUrl = `${APP_URL}/dashboard`;
  if (userId) {
    const { generateWelcomeToken } = await import("@/lib/welcome-token");
    const token = generateWelcomeToken(userId);
    ctaUrl = `${APP_URL}/welcome-login?uid=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`;
  }

  const bodyHtml = `
    ${bodyP("Your AIM Studio account is ready. Here&rsquo;s what&rsquo;s waiting for you:")}
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;width:100%;">
      <tr><td style="padding:7px 0;font-size:13px;color:#d1d5db;line-height:1.6;border-bottom:1px solid #1e1e1e;">
        <span style="color:#e8c97e;margin-right:10px;">&#9654;</span>Exclusive AIM Studio films and series
      </td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#d1d5db;line-height:1.6;border-bottom:1px solid #1e1e1e;">
        <span style="color:#e8c97e;margin-right:10px;">&#9654;</span>Behind-the-scenes work from the studio
      </td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#d1d5db;line-height:1.6;">
        <span style="color:#e8c97e;margin-right:10px;">&#9654;</span>New releases when they drop
      </td></tr>
    </table>
    ${btn("Enter AIM Studio", ctaUrl)}
    ${noteP("If you did not create this account, please ignore this email.")}`;

  await sendEmail({
    to,
    subject: "Welcome to AIM Studio",
    html:    premiumTransactionalEmail({ title: greeting, bodyHtml }),
    type:    "WELCOME",
  });
}

// ── Account notification email ─────────────────────────────────
// Sent for account-level changes: suspension, restoration, etc.
// Uses Microsoft Graph (transactional). Bypasses suppression (ACCOUNT type).
// Never used for marketing. No tracking pixel.

export async function sendAccountEmail(opts: {
  to:       string;
  subject:  string;
  title:    string;
  body:     string;
  ctaUrl?:  string;
  ctaLabel?: string;
}): Promise<void> {
  const ctaHtml = opts.ctaUrl
    ? `<div style="margin:20px 0 0;">${btn(opts.ctaLabel ?? "View Account", opts.ctaUrl)}</div>`
    : "";

  const bodyHtml = `
    ${bodyP(esc(opts.body))}
    ${ctaHtml}
    ${noteP("If you have questions about your account, contact us through the site.")}`;

  await sendEmail({
    to:      opts.to,
    subject: opts.subject,
    html:    premiumTransactionalEmail({ title: opts.title, bodyHtml, label: "Account" }),
    type:    "ACCOUNT",
  });
}
