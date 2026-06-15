// lib/email-template-defaults.ts
// Premium English email template defaults and helpers.
// Used by: ensureSystemEmailTemplates (seeding), resetTemplateToDefault, getTemplatePreview, sendTemplateTestEmail.
// Never imported by public pages or production send functions (those still use hardcoded HTML for now).

import type { EmailType } from "@prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://impactaistudio.com";

// ── HTML primitives ────────────────────────────────────────────

export const T = {
  wrap: (inner: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;background:#111111;border:1px solid #2a2a2a;border-radius:8px;">
        <tr><td style="padding:22px 32px;border-bottom:2px solid #e8c97e;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#f9fafb;letter-spacing:-0.4px;">AIM<span style="color:#e8c97e;">Studio</span></p>
        </td></tr>
        <tr><td style="padding:32px 32px 28px;">
          ${inner}
        </td></tr>
        <tr><td style="padding:18px 32px;background:#0a0a0a;border-top:1px solid #1a1a1a;border-radius:0 0 8px 8px;">
          <p style="margin:0;font-size:11px;color:#4b5563;line-height:1.6;letter-spacing:0.03em;">AIM Studio &nbsp;&middot;&nbsp; Don&rsquo;t look away.</p>
          <p style="margin:4px 0 0;font-size:11px;color:#374151;line-height:1.6;">You are receiving this email because you have an account on AIM Studio.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,

  wrapBulk: (inner: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;background:#111111;border:1px solid #2a2a2a;border-radius:8px;">
        <tr><td style="padding:22px 32px;border-bottom:2px solid #e8c97e;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#f9fafb;letter-spacing:-0.4px;">AIM<span style="color:#e8c97e;">Studio</span></p>
        </td></tr>
        <tr><td style="padding:32px 32px 28px;">
          ${inner}
        </td></tr>
        <tr><td style="padding:18px 32px;background:#0a0a0a;border-top:1px solid #1a1a1a;border-radius:0 0 8px 8px;">
          <p style="margin:0 0 5px;font-size:11px;color:#4b5563;line-height:1.6;letter-spacing:0.03em;">AIM Studio &nbsp;&middot;&nbsp; Don&rsquo;t look away.</p>
          <p style="margin:0;font-size:11px;color:#374151;line-height:1.6;">
            <a href="{{preferencesUrl}}" style="color:#4b5563;text-decoration:underline;">Manage preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="{{unsubscribeUrl}}" style="color:#4b5563;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,

  h1: (text: string) =>
    `<h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#f9fafb;line-height:1.3;">${text}</h1>`,

  p: (text: string) =>
    `<p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.7;">${text}</p>`,

  btn: (label: string, href: string) =>
    `<a href="${href}" style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">${label}</a>`,

  ghost: (label: string, href: string) =>
    `<a href="${href}" style="display:inline-block;color:#e5e7eb;font-size:13px;font-weight:500;text-decoration:none;padding:12px 20px;border:1px solid #3a3a3a;border-radius:3px;">${label}</a>`,

  note: (text: string) =>
    `<p style="margin:20px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">${text}</p>`,

  preheader: (text: string) =>
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${text}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`,
};

// ── Template shape ─────────────────────────────────────────────

export type TemplateRow = {
  name:        string;
  label:       string;
  description: string;
  type:        EmailType;
  subject:     string;
  preheader:   string;
  bodyHtml:    string;
  bodyText:    string;
  isActive:    boolean;
  isSystem:    boolean;
  isDefault:   boolean;
};

// ── Sample variables for preview / test-send ──────────────────
// Safe placeholder data — no real user info, no real tokens.

export const SAMPLE_VARS: Record<string, Record<string, string>> = {
  PASSWORD_RESET: {
    userName:     "Samuel",
    actionUrl:    `${APP_URL}/reset-password/sample`,
    supportEmail: "support@impactaistudio.com",
    date:         "June 4, 2026",
  },
  WELCOME: {
    userName:     "Samuel",
    actionUrl:    `${APP_URL}/dashboard`,
    supportEmail: "support@impactaistudio.com",
  },
  SECURITY_ALERT: {
    userName:         "Samuel",
    eventTitle:       "New device sign-in",
    eventDescription: "A sign-in to your AIM Studio account was detected from a new device.",
    date:             "June 4, 2026",
    deviceInfo:       "Chrome on Windows",
    ipAddress:        "Hidden for privacy",
    actionUrl:        `${APP_URL}/dashboard/settings/security`,
    resetUrl:         `${APP_URL}/forgot-password`,
    supportEmail:     "support@impactaistudio.com",
  },
  ADMIN_ALERT: {
    subject: "Admin alert test",
    body:    "This is a test admin notification from AIM Studio.",
    date:    "June 4, 2026",
  },
  NEW_RELEASE: {
    workTitle:       "The Word Works",
    workType:        "Film",
    description:     "A cinematic exploration of language, identity, and the stories we carry.",
    watchUrl:        `${APP_URL}/watch/the-word-works`,
    detailUrl:       `${APP_URL}/works/the-word-works`,
    imageUrl:        "",
    preferencesUrl:  `${APP_URL}/dashboard/settings`,
    unsubscribeUrl:  `${APP_URL}/unsubscribe/sample`,
  },
  NEW_EPISODE: {
    seriesTitle:    "The Word Works",
    episodeLabel:   "S1E2",
    episodeTitle:   "The Language of Shadows",
    watchUrl:       `${APP_URL}/watch/the-word-works-s1e2`,
    imageUrl:       "",
    preferencesUrl: `${APP_URL}/dashboard/settings`,
    unsubscribeUrl: `${APP_URL}/unsubscribe/sample`,
  },
  ANNOUNCEMENT: {
    title:          "A new chapter from AIM Studio",
    body:           "We have been working on something new. More details coming soon.",
    ctaButton:      `<a href="${APP_URL}/works" style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">View Works</a>`,
    ctaUrl:         `${APP_URL}/works`,
    preferencesUrl: `${APP_URL}/dashboard/settings`,
    unsubscribeUrl: `${APP_URL}/unsubscribe/sample`,
  },
  NOTIFY_ME_FOLLOWUP: {
    greeting:       "Hi Samuel,",
    workTitle:      "The Word Works",
    detailUrl:      `${APP_URL}/works/the-word-works`,
    watchUrl:       `${APP_URL}/watch/the-word-works`,
    preferencesUrl: `${APP_URL}/dashboard/settings`,
    unsubscribeUrl: `${APP_URL}/unsubscribe/sample`,
  },
  ACCOUNT: {
    changeDescription: "Your AIM Studio account password was recently updated.",
    resetUrl:          `${APP_URL}/forgot-password`,
    supportEmail:      "support@impactaistudio.com",
  },
};

// ── Template renderer ─────────────────────────────────────────
// Replaces {{variable}} with values. Used for admin preview/test only.
// Do NOT use this in production sendEmail() or enqueueBulkForRecipients() yet.

export function renderEmailTemplate(
  input: string,
  vars: Record<string, string>,
): string {
  return input.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

// ── Default template definitions ──────────────────────────────

export function getDefaultTemplates(): TemplateRow[] {
  return [
    {
      name:        "PASSWORD_RESET",
      label:       "Password Reset",
      description: "Sent when a user requests a password reset. System — always active.",
      type:        "PASSWORD_RESET",
      subject:     "Reset your AIM Studio password",
      preheader:   "A password reset was requested for your account.",
      bodyHtml: T.wrap(`
        ${T.preheader("A password reset was requested for your account.")}
        ${T.h1("Reset your password")}
        ${T.p("We received a request to reset the password for your AIM Studio account. Click the button below to choose a new password. <strong style='color:#e5e7eb;'>This link expires in 30 minutes.</strong>")}
        ${T.btn("Reset Password", "{{actionUrl}}")}
        ${T.note("If you did not request a password reset, you can safely ignore this email. Your password will not change.")}
        ${T.note("Do not share this link with anyone. AIM Studio will never ask for your password.")}
        ${T.note("If the button doesn&rsquo;t work, copy this link:<br><span style='color:#9ca3af;word-break:break-all;font-size:11px;'>{{actionUrl}}</span>")}
      `),
      bodyText: `Reset your AIM Studio password\n\nWe received a request to reset the password for your account.\n\nReset link (expires in 30 minutes):\n{{actionUrl}}\n\nIf you did not request a password reset, you can safely ignore this email.\nDo not share this link with anyone.\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: true, isDefault: true,
    },
    {
      name:        "WELCOME",
      label:       "Welcome",
      description: "Sent after a new account is created. System — always active.",
      type:        "WELCOME",
      subject:     "Welcome to AIM Studio",
      preheader:   "Your account is ready. Start watching.",
      bodyHtml: T.wrap(`
        ${T.preheader("Your account is ready. Start watching.")}
        ${T.h1("Welcome, {{userName}}")}
        ${T.p("Your AIM Studio account is ready. Here&rsquo;s what&rsquo;s waiting for you:")}
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;">
          <tr><td style="padding:6px 0;font-size:13px;color:#d1d5db;line-height:1.6;">
            <span style="color:#e8c97e;margin-right:8px;">&#9654;</span> Exclusive AIM Studio films and series
          </td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#d1d5db;line-height:1.6;">
            <span style="color:#e8c97e;margin-right:8px;">&#9654;</span> Behind-the-scenes work from the studio
          </td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#d1d5db;line-height:1.6;">
            <span style="color:#e8c97e;margin-right:8px;">&#9654;</span> New releases when they drop
          </td></tr>
        </table>
        ${T.btn("Enter AIM Studio", "{{actionUrl}}")}
        ${T.note("If you did not create this account, please ignore this email.")}
      `),
      bodyText: `Welcome to AIM Studio\n\nYour account is ready, {{userName}}.\n\nWhat's waiting for you:\n- Exclusive AIM Studio films and series\n- Behind-the-scenes work from the studio\n- New releases when they drop\n\nEnter AIM Studio:\n{{actionUrl}}\n\nIf you did not create this account, please ignore this email.\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: true, isDefault: true,
    },
    {
      name:        "SECURITY_ALERT",
      label:       "Security Alert",
      description: "Sent on suspicious login, new device, or security events. System — always active. No tracking pixels.",
      type:        "SECURITY_ALERT",
      subject:     "Security alert for your AIM Studio account",
      preheader:   "We noticed something unusual on your account.",
      bodyHtml: T.wrap(`
        ${T.preheader("We noticed something unusual on your account.")}
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#f87171;">Security Alert</p>
        ${T.h1("{{eventTitle}}")}
        ${T.p("{{eventDescription}}")}
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;">
          <tr><td style="padding:16px 20px;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="padding:5px 0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;width:90px;">Date</td>
                <td style="padding:5px 0;font-size:13px;color:#e5e7eb;">{{date}}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Device</td>
                <td style="padding:5px 0;font-size:13px;color:#e5e7eb;">{{deviceInfo}}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Location</td>
                <td style="padding:5px 0;font-size:13px;color:#e5e7eb;">{{ipAddress}}</td>
              </tr>
            </table>
          </td></tr>
        </table>
        ${T.btn("Review Account Security", "{{actionUrl}}")}
        ${T.note("If this was you, no action is needed.")}
        ${T.note("If this was <strong>not</strong> you, <a href='{{resetUrl}}' style='color:#f87171;'>reset your password immediately</a> and contact support at <a href='mailto:{{supportEmail}}' style='color:#e8c97e;'>{{supportEmail}}</a>.")}
      `),
      bodyText: `Security Alert — AIM Studio\n\n{{eventTitle}}\n\n{{eventDescription}}\n\nDate: {{date}}\nDevice: {{deviceInfo}}\nLocation: {{ipAddress}}\n\nReview your account:\n{{actionUrl}}\n\nIf this was NOT you, reset your password immediately:\n{{resetUrl}}\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: true, isDefault: true,
    },
    {
      name:        "ADMIN_ALERT",
      label:       "Admin Alert / Test",
      description: "Used for admin test emails and internal alerts. System — always active.",
      type:        "ADMIN_ALERT",
      subject:     "{{subject}}",
      preheader:   "Admin notification from AIM Studio.",
      bodyHtml: T.wrap(`
        ${T.preheader("Admin notification from AIM Studio.")}
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Admin Notification</p>
        ${T.h1("{{subject}}")}
        ${T.p("{{body}}")}
        ${T.note("Sent: {{date}}")}
      `),
      bodyText: `[Admin] {{subject}}\n\n{{body}}\n\nSent: {{date}}\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: true, isDefault: true,
    },
    {
      name:        "NEW_RELEASE",
      label:       "New Release",
      description: "Sent to opted-in users when a new film, series, or work is published.",
      type:        "NEW_RELEASE",
      subject:     "New Release: {{workTitle}}",
      preheader:   "{{workTitle}} is now available on AIM Studio.",
      bodyHtml: T.wrapBulk(`
        ${T.preheader("{{workTitle}} is now available on AIM Studio.")}
        <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#e8c97e;">Now Available</p>
        <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">{{workType}}</p>
        ${T.h1("{{workTitle}}")}
        ${T.p("{{description}}")}
        <table cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
          <tr>
            <td style="padding-right:8px;">${T.btn("Watch Now", "{{watchUrl}}")}</td>
            <td>${T.ghost("View Details", "{{detailUrl}}")}</td>
          </tr>
        </table>
      `),
      bodyText: `Now Available — {{workTitle}}\n\n{{workType}}\n\n{{description}}\n\nWatch now:\n{{watchUrl}}\n\nView details:\n{{detailUrl}}\n\n—\nAIM Studio | Don't look away.\n\nManage preferences: {{preferencesUrl}}\nUnsubscribe: {{unsubscribeUrl}}`,
      isActive: true, isSystem: false, isDefault: true,
    },
    {
      name:        "NEW_EPISODE",
      label:       "New Episode",
      description: "Sent to opted-in users when a new episode is published.",
      type:        "NEW_EPISODE",
      subject:     "New episode: {{seriesTitle}} — {{episodeLabel}}",
      preheader:   "{{episodeTitle}} is now streaming.",
      bodyHtml: T.wrapBulk(`
        ${T.preheader("{{episodeTitle}} is now streaming.")}
        <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#e8c97e;">New Episode</p>
        <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">{{seriesTitle}}</p>
        ${T.h1("{{episodeLabel}} — {{episodeTitle}}")}
        ${T.p("A new episode of <strong style='color:#e5e7eb;'>{{seriesTitle}}</strong> is now available.")}
        ${T.btn("Watch Now", "{{watchUrl}}")}
      `),
      bodyText: `New Episode — {{seriesTitle}}\n\n{{episodeLabel}} — {{episodeTitle}}\n\nA new episode of {{seriesTitle}} is now available.\n\nWatch now:\n{{watchUrl}}\n\n—\nAIM Studio | Don't look away.\n\nManage preferences: {{preferencesUrl}}\nUnsubscribe: {{unsubscribeUrl}}`,
      isActive: true, isSystem: false, isDefault: true,
    },
    {
      name:        "ANNOUNCEMENT",
      label:       "Studio Announcement",
      description: "Studio-wide broadcast sent via /admin/notifications.",
      type:        "ANNOUNCEMENT",
      subject:     "{{title}}",
      preheader:   "{{title}}",
      bodyHtml: T.wrapBulk(`
        ${T.preheader("{{title}}")}
        <p style="margin:0 0 20px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;text-align:center;">From the Studio</p>
        ${T.h1("{{title}}")}
        ${T.p("{{body}}")}
        <p style="margin:0 0 8px;">{{ctaButton}}</p>
      `),
      bodyText: `From the Studio\n\n{{title}}\n\n{{body}}\n\n{{ctaUrl}}\n\n—\nAIM Studio | Don't look away.\n\nManage preferences: {{preferencesUrl}}\nUnsubscribe: {{unsubscribeUrl}}`,
      isActive: true, isSystem: false, isDefault: true,
    },
    {
      name:        "NOTIFY_ME_FOLLOWUP",
      label:       "Send Notice",
      description: "Sent to CTA signups when a work is ready. Triggered via Send Notice from the CTA edit page.",
      type:        "NOTIFY_ME_FOLLOWUP",
      subject:     "It's here: {{workTitle}}",
      preheader:   "{{workTitle}} is now available on AIM Studio.",
      bodyHtml: T.wrapBulk(`
        ${T.preheader("{{workTitle}} is now available on AIM Studio.")}
        <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#e8c97e;">You asked us to let you know.</p>
        ${T.h1("{{workTitle}}")}
        ${T.p("{{greeting}} <strong style='color:#e5e7eb;'>{{workTitle}}</strong> is ready now.")}
        <table cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
          <tr>
            <td style="padding-right:8px;">${T.btn("View the Project", "{{detailUrl}}")}</td>
            <td>${T.ghost("Watch Now", "{{watchUrl}}")}</td>
          </tr>
        </table>
      `),
      bodyText: `It's here: {{workTitle}}\n\n{{greeting}} You asked us to let you know. {{workTitle}} is ready now.\n\nView the project:\n{{detailUrl}}\n\nWatch now:\n{{watchUrl}}\n\n—\nAIM Studio | Don't look away.\n\nManage preferences: {{preferencesUrl}}\nUnsubscribe: {{unsubscribeUrl}}`,
      isActive: true, isSystem: false, isDefault: true,
    },
    {
      name:        "ACCOUNT",
      label:       "Account Update",
      description: "Sent on account changes such as suspension, restoration, or status updates.",
      type:        "ACCOUNT",
      subject:     "Account update — AIM Studio",
      preheader:   "An update was made to your AIM Studio account.",
      bodyHtml: T.wrap(`
        ${T.preheader("An update was made to your AIM Studio account.")}
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Account</p>
        ${T.h1("Account update")}
        ${T.p("{{changeDescription}}")}
        ${T.note("If you did not initiate this change, <a href='{{resetUrl}}' style='color:#e8c97e;'>reset your password</a> or contact support at <a href='mailto:{{supportEmail}}' style='color:#e8c97e;'>{{supportEmail}}</a>.")}
      `),
      bodyText: `Account update — AIM Studio\n\n{{changeDescription}}\n\nIf you did not initiate this change, reset your password immediately:\n{{resetUrl}}\n\n—\nAIM Studio | Don't look away.`,
      isActive: true, isSystem: false, isDefault: true,
    },
  ];
}

export function getDefaultTemplateByName(name: string): TemplateRow | null {
  return getDefaultTemplates().find((t) => t.name === name) ?? null;
}
