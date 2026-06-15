"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { sendEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTemplatePreview } from "@/lib/actions/email-templates";
import { premiumTransactionalEmail } from "@/lib/email-base";
import {
  buildNewReleaseEmail,
  buildNewEpisodeEmail,
  buildNotifyMeFollowupEmail,
  buildAnnouncementEmail,
} from "@/lib/bulk-email";
import type { EmailType } from "@prisma/client";

// ── Test Graph email ──────────────────────────────────────────
export async function testGraphEmail(): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();

  // Use testEmailRecipient from AdminSettings if set, else fall back to admin's own email
  const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
  const to = settings?.testEmailRecipient?.trim() || admin.email!;

  try {
    await sendEmail({
      to,
      subject: "AIM Studio — Graph email test",
      html: premiumTransactionalEmail({
        title: "Email test successful",
        bodyHtml: `
          <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
            Microsoft Graph is correctly configured and sending email.
          </p>
          <p style="margin:0;font-size:13px;color:#6b7280;">
            Sent to: <strong style="color:#e5e7eb;">${to}</strong>
          </p>
        `,
        label: "Admin Test",
      }),
      type: "ADMIN_ALERT",
      metadata: { test: true },
    });
    return { ok: true, message: `Test email sent to ${to}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, message };
  }
}

// ── Send test email for a specific template (admin only) ──────
// Renders the template with safe sample variables and sends to the admin's email.
// Has NO effect on live sendEmail() or production queue behavior.

export async function sendTemplateTestEmail(
  templateId: string,
): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();

  const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
  const to = settings?.testEmailRecipient?.trim() || admin.email!;

  const preview = await getTemplatePreview(templateId);
  if ("error" in preview) return { ok: false, message: preview.error };

  try {
    await sendEmail({
      to,
      subject: `[TEST] ${preview.subject}`,
      html:    preview.renderedHtml,
      type:    "ADMIN_ALERT",
      metadata: { test: true, templateId },
    });
    return { ok: true, message: `Test email sent to ${to}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Send failed." };
  }
}

// ── Preview test email HTML/subject without sending ───────────
// Returns rendered HTML + subject for any email type so the admin can
// inspect the email before deciding whether to send it.
// Safe: reads DB, never sends email, never modifies application state.

export async function previewTestEmail(opts: {
  type:                 string;
  workId?:              string;
  castingApplicationId?: string;
}): Promise<
  | { ok: true; subject: string; html: string; ctaLabel?: string; ctaUrl?: string; recipientType: string; estimatedRecipients?: number }
  | { ok: false; error: string }
> {
  await requireAdmin();

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const type = opts.type as EmailType;

  try {
    switch (type) {
      case "PASSWORD_RESET": {
        const subject = "Reset your AIM Studio password";
        const html    = premiumTransactionalEmail({
          title:    "Reset your password",
          bodyHtml: `
            <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.7;">
              We received a request to reset the password for your AIM Studio account.
              Click the button below to choose a new password.
              <strong style="color:#e5e7eb;">This link expires in 30 minutes.</strong>
            </p>
            <a href="${APP_URL}/reset-password?token=SAMPLE_TOKEN"
               style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                      letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
              Reset Password
            </a>
            <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
              If you did not request a password reset, you can safely ignore this email.
            </p>
          `,
        });
        return { ok: true, subject, html, ctaLabel: "Reset Password", ctaUrl: `${APP_URL}/reset-password`, recipientType: "Individual user (on request)" };
      }

      case "WELCOME": {
        const subject = "Welcome to AIM Studio";
        const html    = premiumTransactionalEmail({
          title:    "Welcome, Samuel",
          bodyHtml: `
            <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.7;">
              Your AIM Studio account is ready. Here&rsquo;s what&rsquo;s waiting for you:
            </p>
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
            <a href="${APP_URL}/dashboard"
               style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                      letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
              Enter AIM Studio
            </a>
          `,
        });
        return { ok: true, subject, html, ctaLabel: "Enter AIM Studio", ctaUrl: `${APP_URL}/dashboard`, recipientType: "New registered users" };
      }

      case "SECURITY_ALERT": {
        const subject = "Security alert — AIM Studio";
        const html    = premiumTransactionalEmail({
          title:    "New device sign-in detected",
          label:    "Security Alert",
          bodyHtml: `
            <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.7;">
              A sign-in to your AIM Studio account was detected from a new device.
            </p>
            <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
              If this was you, no action is needed.
              If this was <strong style="color:#e5e7eb;">not</strong> you,
              <a href="${APP_URL}/forgot-password" style="color:#f87171;">reset your password immediately</a>.
            </p>
          `,
        });
        return { ok: true, subject, html, ctaLabel: "Reset Password", ctaUrl: `${APP_URL}/forgot-password`, recipientType: "Individual user (on event)" };
      }

      case "ACCOUNT": {
        const subject = "Account update — AIM Studio";
        const html    = premiumTransactionalEmail({
          title:    "Account update",
          label:    "Account",
          bodyHtml: `
            <p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.7;">
              Your AIM Studio account password was recently updated.
            </p>
            <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
              If you did not initiate this change,
              <a href="${APP_URL}/forgot-password" style="color:#e8c97e;">reset your password</a>
              or contact support.
            </p>
          `,
        });
        return { ok: true, subject, html, recipientType: "Individual user (on account change)" };
      }

      case "ADMIN_ALERT": {
        const subject = "Admin notification — AIM Studio";
        const html    = premiumTransactionalEmail({
          title:    "Admin notification",
          label:    "Admin",
          bodyHtml: `<p style="margin:0 0 18px;font-size:14px;color:#9ca3af;line-height:1.7;">This is a test admin notification from AIM Studio.</p>`,
        });
        return { ok: true, subject, html, recipientType: "Admin users" };
      }

      case "NEW_RELEASE": {
        if (!opts.workId) return { ok: false, error: "Select a work to preview the New Release email." };
        const work = await prisma.work.findUnique({
          where:  { id: opts.workId },
          select: { slug: true, title: true, type: true, description: true, genres: true, posterUrl: true, trailerUrl: true, previewClipUrl: true, videoUrl: true },
        });
        if (!work) return { ok: false, error: "Work not found." };

        const built = buildNewReleaseEmail({
          recipientEmail: "preview@aimstudio.app",
          workTitle:      work.title,
          workSlug:       work.slug,
          workType:       work.type,
          genres:         work.genres,
          description:    work.description,
          imageUrl:       work.posterUrl,
          hasTrailer:     !!work.trailerUrl,
          hasPreview:     !!work.previewClipUrl,
          hasVideo:       !!work.videoUrl,
        });

        const count = await prisma.user.count({
          where: {
            status: "ACTIVE",
            email:  { not: "" },
            OR: [{ preferences: null }, { preferences: { emailNewReleases: true, newReleaseNotifications: true } }],
          },
        });

        return {
          ok:  true,
          subject: built.subject,
          html:    built.html,
          ctaLabel: !!work.trailerUrl ? "Watch Trailer" : !!work.previewClipUrl ? "Watch Preview" : !!work.videoUrl ? "Watch Full Film" : "View Details",
          ctaUrl:   `${APP_URL}/watch/${work.slug}`,
          recipientType: "Opted-in registered users",
          estimatedRecipients: count,
        };
      }

      case "NEW_EPISODE": {
        if (!opts.workId) return { ok: false, error: "Select an episode to preview the New Episode email." };
        const episode = await prisma.work.findUnique({
          where:  { id: opts.workId },
          select: { slug: true, title: true, type: true, episodeNumber: true, seasonNumber: true, posterUrl: true, parent: { select: { slug: true, title: true } } },
        });
        if (!episode)           return { ok: false, error: "Episode not found." };
        if (!episode.parent)    return { ok: false, error: "Episode has no parent series." };

        const built = buildNewEpisodeEmail({
          recipientEmail: "preview@aimstudio.app",
          seriesTitle:    episode.parent.title,
          seriesSlug:     episode.parent.slug,
          episodeTitle:   episode.title,
          episodeNumber:  episode.episodeNumber,
          seasonNumber:   episode.seasonNumber,
          imageUrl:       episode.posterUrl,
        });

        const count = await prisma.user.count({
          where: {
            status: "ACTIVE",
            email:  { not: "" },
            OR: [{ preferences: null }, { preferences: { newEpisodeNotifications: true } }],
          },
        });

        return {
          ok:  true,
          subject: built.subject,
          html:    built.html,
          ctaLabel: "Watch Now",
          ctaUrl:   `${APP_URL}/watch/${episode.parent.slug}`,
          recipientType: "Opted-in registered users",
          estimatedRecipients: count,
        };
      }

      case "NOTIFY_ME_FOLLOWUP": {
        if (!opts.workId) return { ok: false, error: "Select a work to preview the Notify Me email." };
        const work = await prisma.work.findUnique({
          where:  { id: opts.workId },
          select: { slug: true, title: true, type: true, posterUrl: true, trailerUrl: true, previewClipUrl: true, videoUrl: true },
        });
        if (!work) return { ok: false, error: "Work not found." };

        const built = buildNotifyMeFollowupEmail({
          recipientEmail: "preview@aimstudio.app",
          recipientName:  "Samuel",
          workTitle:      work.title,
          workSlug:       work.slug,
          workType:       work.type,
          imageUrl:       work.posterUrl,
          hasTrailer:     !!work.trailerUrl,
          hasPreview:     !!work.previewClipUrl,
          hasVideo:       !!work.videoUrl,
        });

        const cta = await prisma.notifyMeCta.findFirst({ where: { workId: opts.workId }, select: { _count: { select: { signups: true } } } });
        const count = cta?._count?.signups ?? 0;

        return {
          ok:  true,
          subject: built.subject,
          html:    built.html,
          ctaLabel: !!work.trailerUrl ? "Watch Trailer" : !!work.previewClipUrl ? "Watch Preview" : !!work.videoUrl ? "Watch Now" : "View Details",
          ctaUrl:   `${APP_URL}/works/${work.slug}`,
          recipientType: "Notify Me signups for this work",
          estimatedRecipients: count,
        };
      }

      case "ANNOUNCEMENT": {
        const built = buildAnnouncementEmail({
          recipientEmail: "preview@aimstudio.app",
          title:          "A new chapter from AIM Studio",
          body:           "We have been working on something new. More details coming soon.",
          href:           `${APP_URL}/works`,
          hrefLabel:      "View Works",
        });
        const count = await prisma.user.count({ where: { status: "ACTIVE", email: { not: "" } } });
        return {
          ok:  true,
          subject: built.subject,
          html:    built.html,
          ctaLabel: "View Works",
          ctaUrl:   `${APP_URL}/works`,
          recipientType: "All active registered users",
          estimatedRecipients: count,
        };
      }

      case "CASTING_RECEIVED": {
        const html = premiumTransactionalEmail({
          title: "Application received",
          label: "Casting",
          bodyHtml: `
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">Hi Samuel,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
              Thank you for applying for the role of <strong style="color:#e5e7eb;">Lead Actor (Sample Role)</strong>.
              Your application has been received and is currently under review.
            </p>
            <a href="${APP_URL}/casting/applications/track/SAMPLE_TOKEN"
               style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                      letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
              Track My Application
            </a>
          `,
        });
        return { ok: true, subject: "We received your casting application — AIM Studio", html, recipientType: "Casting applicant (on submission)" };
      }

      case "CASTING_REQUIREMENTS_NOT_MET": {
        const html = premiumTransactionalEmail({
          title: "Review required",
          label: "Casting",
          bodyHtml: `
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">Hi Samuel,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
              Thank you for your interest in the role of <strong style="color:#e5e7eb;">Lead Actor (Sample Role)</strong>.
              After reviewing your submission, we found that it does not currently meet the review requirements.
            </p>
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Please review the following:</p>
            <ul style="margin:8px 0 16px;padding-left:20px;">
              <li style="margin-bottom:8px;font-size:14px;color:#9ca3af;line-height:1.6;">Headshot must be a clear, recent photograph</li>
              <li style="margin-bottom:8px;font-size:14px;color:#9ca3af;line-height:1.6;">Showreel link is required for this role</li>
            </ul>
            <a href="${APP_URL}/casting/applications/track/SAMPLE_TOKEN"
               style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                      letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
              View My Application
            </a>
          `,
        });
        return { ok: true, subject: "Action needed on your casting application — AIM Studio", html, recipientType: "Casting applicant (on review)" };
      }

      case "CASTING_READY_FOR_REVIEW": {
        const html = premiumTransactionalEmail({
          title: "New submission ready for review",
          label: "Admin — Casting",
          bodyHtml: `
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">A casting application has passed agent review and is ready for your decision.</p>
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin:0 0 20px;padding:16px 20px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;width:100%;">
              <tr><td style="padding:5px 0;">
                <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Applicant</p>
                <p style="margin:0;font-size:15px;font-weight:600;color:#f9fafb;">Samuel Aderemi</p>
              </td></tr>
              <tr><td style="padding:10px 0 5px;">
                <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Role</p>
                <p style="margin:0;font-size:14px;color:#e5e7eb;">Lead Actor (Sample Role)</p>
              </td></tr>
              <tr><td style="padding:10px 0 0;">
                <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Agent Score</p>
                <p style="margin:0;font-size:20px;font-weight:700;color:#e8c97e;">84 / 100</p>
              </td></tr>
            </table>
            <a href="${APP_URL}/admin/casting/SAMPLE_ID"
               style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                      letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
              Review Application
            </a>
          `,
        });
        return { ok: true, subject: "Casting submission ready for review — Lead Actor (Sample Role)", html, recipientType: "Admin (on agent review completion)" };
      }

      case "CASTING_SHORTLISTED": {
        const html = premiumTransactionalEmail({
          title: "You have been shortlisted",
          label: "Casting",
          bodyHtml: `
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">Hi Samuel,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
              We are pleased to let you know that your application for
              <strong style="color:#e5e7eb;">Lead Actor (Sample Role)</strong> has been shortlisted by our team.
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.7;">
              Our team will be in touch with you soon regarding next steps.
            </p>
            <a href="${APP_URL}/casting/applications/track/SAMPLE_TOKEN"
               style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                      letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
              View Application Status
            </a>
          `,
        });
        return { ok: true, subject: "You have been shortlisted — AIM Studio", html, recipientType: "Casting applicant (on shortlist)" };
      }

      case "CASTING_CONTACTED": {
        const html = premiumTransactionalEmail({
          title: "We are reaching out",
          label: "Casting",
          bodyHtml: `
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">Hi Samuel,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
              The AIM Studio casting team has reached out regarding your application for
              <strong style="color:#e5e7eb;">Lead Actor (Sample Role)</strong>.
            </p>
            <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
              Please respond through the contact channel our team used to reach you.
            </p>
          `,
        });
        return { ok: true, subject: "AIM Studio is reaching out — Lead Actor (Sample Role)", html, recipientType: "Casting applicant (on contact)" };
      }

      case "CASTING_SELECTED": {
        const html = premiumTransactionalEmail({
          title: "Congratulations",
          label: "Casting",
          bodyHtml: `
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">Hi Samuel,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
              Congratulations. You have been selected for the role of
              <strong style="color:#e5e7eb;">Lead Actor (Sample Role)</strong> at AIM Studio.
            </p>
            <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.7;">
              Our team will contact you shortly with details on next steps and production logistics.
            </p>
            <a href="${APP_URL}/casting/applications/track/SAMPLE_TOKEN"
               style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                      letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
              View Application Status
            </a>
            <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">We look forward to working with you.</p>
          `,
        });
        return { ok: true, subject: "Congratulations — you have been selected — AIM Studio", html, recipientType: "Casting applicant (on selection)" };
      }

      case "CASTING_NOT_SELECTED": {
        const html = premiumTransactionalEmail({
          title: "Thank you for applying",
          label: "Casting",
          bodyHtml: `
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">Hi Samuel,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
              Thank you for applying for the role of <strong style="color:#e5e7eb;">Lead Actor (Sample Role)</strong>.
              We genuinely appreciate the time and effort you put into your application.
            </p>
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
              After careful consideration, we have decided to move forward with another candidate for this particular role.
              This decision reflects the specific requirements of this production and is not a reflection of your talent.
            </p>
            <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
              We encourage you to follow AIM Studio for future casting opportunities.
            </p>
          `,
        });
        return { ok: true, subject: "Thank you for applying — AIM Studio", html, recipientType: "Casting applicant (on final decision)" };
      }

      case "CASTING_WITHDRAWN": {
        const html = premiumTransactionalEmail({
          title: "Application withdrawn",
          label: "Casting",
          bodyHtml: `
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">Hi Samuel,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
              This confirms that your application for
              <strong style="color:#e5e7eb;">Lead Actor (Sample Role)</strong> has been successfully withdrawn.
            </p>
            <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
              Thank you for your interest in AIM Studio. We hope to see you apply for future roles.
            </p>
          `,
        });
        return { ok: true, subject: "Your casting application has been withdrawn — AIM Studio", html, recipientType: "Casting applicant (on withdrawal)" };
      }

      default:
        return { ok: false, error: `Email type "${type}" does not have a preview yet.` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to build preview." };
  }
}

// ── Send test email for any type (admin only) ─────────────────
// Sends a test copy to the specified recipient (or admin's email).
// Does NOT send to subscribers. Does NOT mark campaigns as sent.
// Does NOT update application progress. Logged as test in EmailLog.

export async function sendTestEmailByType(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin();

  const type                 = (formData.get("type") as string)?.trim();
  const workId               = (formData.get("workId") as string)?.trim() || undefined;
  const castingApplicationId = (formData.get("castingApplicationId") as string)?.trim() || undefined;
  const rawTo                = (formData.get("to") as string)?.trim();

  const settings = await prisma.adminSettings.findUnique({ where: { id: "singleton" } });
  const to = rawTo || settings?.testEmailRecipient?.trim() || admin.email!;

  if (!type) return { ok: false, message: "Email type is required." };

  const preview = await previewTestEmail({ type, workId, castingApplicationId });
  if (!preview.ok) return { ok: false, message: preview.error };

  try {
    await sendEmail({
      to,
      subject:  `[TEST] ${preview.subject}`,
      html:     preview.html,
      type:     "ADMIN_ALERT",
      metadata: { test: true, emailType: type, workId, castingApplicationId },
    });
    return { ok: true, message: `Test email sent to ${to}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Send failed." };
  }
}

// ── Suppression management ────────────────────────────────────
export async function addSuppression(formData: FormData) {
  await requireAdmin();
  const email  = (formData.get("email") as string)?.toLowerCase().trim();
  const reason = (formData.get("reason") as string) || "manual";
  if (!email) redirect("/admin/email?tab=suppression&error=Email+is+required");

  await prisma.emailSuppression.upsert({
    where:  { email },
    create: { email, reason, source: "admin", active: true },
    update: { reason, active: true },
  });
  revalidatePath("/admin/email");
  redirect("/admin/email?tab=suppression");
}

// Soft-lift: marks inactive but keeps the record for audit
export async function removeSuppression(email: string) {
  await requireAdmin();
  await prisma.emailSuppression.update({
    where: { email },
    data:  { active: false },
  });
  revalidatePath("/admin/email");
}

// Hard delete: permanently removes the suppression record
export async function deleteSuppression(email: string) {
  await requireAdmin();
  await prisma.emailSuppression.delete({ where: { email } });
  revalidatePath("/admin/email");
}

// Bulk import suppressions from pasted email list
export async function bulkImportSuppression(formData: FormData) {
  await requireAdmin();
  const raw    = (formData.get("emails") as string) ?? "";
  const reason = (formData.get("reason") as string) || "manual";

  const emails = raw
    .split(/[\n,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@") && e.length > 3);

  if (emails.length === 0) {
    redirect("/admin/email?tab=import&error=No+valid+email+addresses+found");
  }

  const unique = [...new Set(emails)];
  let imported = 0;
  let skipped  = 0;

  for (const email of unique) {
    const existing = await prisma.emailSuppression.findUnique({ where: { email } });
    if (existing?.active) { skipped++; continue; }
    await prisma.emailSuppression.upsert({
      where:  { email },
      create: { email, reason, source: "admin", active: true },
      update: { reason, active: true },
    });
    imported++;
  }

  revalidatePath("/admin/email");
  redirect(`/admin/email?tab=import&imported=${imported}&skipped=${skipped}`);
}
