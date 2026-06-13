import "server-only";
import { sendEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type BaseArgs = {
  to:        string;
  name:      string;
  roleTitle: string;
};

// ── 1. Application received ───────────────────────────────────

export async function sendCastingReceived(args: BaseArgs & { trackingToken: string }) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;
  await sendEmail({
    to: args.to,
    subject: "We received your casting application — AIM Studio",
    type: "CASTING_RECEIVED",
    html: `
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">Hi ${escHtml(args.name)},</p>
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">
        Thank you for applying for the role of <strong style="color:#f9fafb;">${escHtml(args.roleTitle)}</strong> at AIM Studio.
        Your application has been received and is currently under review.
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#e5e7eb;">
        You can track the status of your application at any time using the link below.
      </p>
      ${ctaButton(trackUrl, "Track My Application")}
      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">
        You will receive an email when your application status changes.
      </p>
    `,
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 2. Requirements not met ───────────────────────────────────

export async function sendCastingRequirementsNotMet(
  args: BaseArgs & { reasons: string[]; trackingToken: string; canResubmit: boolean },
) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;
  const reasonList = args.reasons.length > 0
    ? `<ul style="margin:8px 0 16px;padding-left:20px;color:#e5e7eb;font-size:14px;">
        ${args.reasons.map((r) => `<li style="margin-bottom:6px;">${escHtml(r)}</li>`).join("")}
      </ul>`
    : "";

  await sendEmail({
    to: args.to,
    subject: "Action needed on your casting application — AIM Studio",
    type: "CASTING_REQUIREMENTS_NOT_MET",
    html: `
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">Hi ${escHtml(args.name)},</p>
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">
        Thank you for your interest in the role of <strong style="color:#f9fafb;">${escHtml(args.roleTitle)}</strong>.
        After reviewing your submission, we found that it does not currently meet the review requirements.
      </p>
      ${reasonList ? `<p style="margin:0 0 6px;font-size:14px;color:#9ca3af;">Please review the following:</p>${reasonList}` : ""}
      ${args.canResubmit
        ? `<p style="margin:0 0 16px;font-size:15px;color:#e5e7eb;">
            You may update and resubmit your application. Please ensure all required materials are included before resubmitting.
           </p>
           ${ctaButton(trackUrl, "View My Application")}`
        : `<p style="margin:0 0 12px;font-size:14px;color:#6b7280;">
            If you believe this is an error or have questions, please contact us.
           </p>`}
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
        We appreciate your time and interest in working with AIM Studio.
      </p>
    `,
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 3. Ready for admin review (admin notification) ────────────

export async function sendCastingReadyForReview(args: {
  adminEmail: string;
  applicantName: string;
  roleTitle: string;
  applicationId: string;
  score: number;
}) {
  const adminUrl = `${APP_URL}/admin/casting/${args.applicationId}`;
  await sendEmail({
    to: args.adminEmail,
    subject: `New casting submission ready for review — ${args.roleTitle}`,
    type: "CASTING_READY_FOR_REVIEW",
    html: `
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">
        A casting application is ready for your review.
      </p>
      <div style="margin:0 0 16px;padding:14px 16px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;">
        <p style="margin:0 0 6px;font-size:14px;color:#9ca3af;">Applicant</p>
        <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#f9fafb;">${escHtml(args.applicantName)}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#9ca3af;">Role</p>
        <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">${escHtml(args.roleTitle)}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#9ca3af;">Agent Score</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#e8c97e;">${args.score} / 100</p>
      </div>
      ${ctaButton(adminUrl, "Review Application")}
    `,
    metadata: { roleTitle: args.roleTitle, score: args.score },
  });
}

// ── 4. Shortlisted ────────────────────────────────────────────

export async function sendCastingShortlisted(args: BaseArgs & { trackingToken: string }) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;
  await sendEmail({
    to: args.to,
    subject: "You have been shortlisted — AIM Studio",
    type: "CASTING_SHORTLISTED",
    html: `
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">Hi ${escHtml(args.name)},</p>
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">
        We are pleased to let you know that your application for <strong style="color:#f9fafb;">${escHtml(args.roleTitle)}</strong>
        has been shortlisted by our team.
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#e5e7eb;">
        Our team will be in touch with you soon regarding next steps. Please keep an eye on your inbox.
      </p>
      ${ctaButton(trackUrl, "View Application Status")}
    `,
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 5. Contacted ──────────────────────────────────────────────

export async function sendCastingContacted(args: BaseArgs & { trackingToken: string; message?: string }) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;
  await sendEmail({
    to: args.to,
    subject: `AIM Studio is reaching out — ${args.roleTitle}`,
    type: "CASTING_CONTACTED",
    html: `
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">Hi ${escHtml(args.name)},</p>
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">
        The AIM Studio casting team has reached out regarding your application for
        <strong style="color:#f9fafb;">${escHtml(args.roleTitle)}</strong>.
      </p>
      ${args.message ? `<p style="margin:0 0 16px;font-size:15px;color:#e5e7eb;">${escHtml(args.message)}</p>` : ""}
      <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;">
        Please respond through the contact channel our team used to reach you.
      </p>
      ${ctaButton(trackUrl, "View Application Status")}
    `,
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 6. Selected ───────────────────────────────────────────────

export async function sendCastingSelected(args: BaseArgs & { trackingToken: string }) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;
  await sendEmail({
    to: args.to,
    subject: `Congratulations — you have been selected — AIM Studio`,
    type: "CASTING_SELECTED",
    html: `
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">Hi ${escHtml(args.name)},</p>
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">
        Congratulations. You have been selected for the role of
        <strong style="color:#f9fafb;">${escHtml(args.roleTitle)}</strong> at AIM Studio.
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#e5e7eb;">
        Our team will contact you shortly with details on next steps and production logistics.
        Please continue to monitor your inbox and the casting portal.
      </p>
      ${ctaButton(trackUrl, "View Application Status")}
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
        We look forward to working with you.
      </p>
    `,
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 7. Not selected ───────────────────────────────────────────

export async function sendCastingNotSelected(args: BaseArgs) {
  await sendEmail({
    to: args.to,
    subject: "Thank you for applying — AIM Studio",
    type: "CASTING_NOT_SELECTED",
    html: `
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">Hi ${escHtml(args.name)},</p>
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">
        Thank you for applying for the role of <strong style="color:#f9fafb;">${escHtml(args.roleTitle)}</strong>.
        We genuinely appreciate the time and effort you put into your application.
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">
        After careful consideration, we have decided to proceed with another candidate for this particular role.
        This decision reflects the specific requirements of this production and is not a reflection of your talent.
      </p>
      <p style="margin:0 0 0;font-size:14px;color:#9ca3af;">
        We encourage you to follow AIM Studio for future casting opportunities.
      </p>
    `,
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 8. Withdrawn ──────────────────────────────────────────────

export async function sendCastingWithdrawn(args: BaseArgs) {
  await sendEmail({
    to: args.to,
    subject: "Your casting application has been withdrawn — AIM Studio",
    type: "CASTING_WITHDRAWN",
    html: `
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">Hi ${escHtml(args.name)},</p>
      <p style="margin:0 0 12px;font-size:15px;color:#e5e7eb;">
        This confirms that your application for <strong style="color:#f9fafb;">${escHtml(args.roleTitle)}</strong>
        has been successfully withdrawn.
      </p>
      <p style="margin:0 0 0;font-size:14px;color:#9ca3af;">
        Thank you for your interest in AIM Studio. We hope to see you apply for future roles.
      </p>
    `,
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── Helpers ───────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:4px 0 0;padding:11px 24px;background:#e8c97e;color:#0a0a0a;font-weight:700;font-size:14px;border-radius:999px;text-decoration:none;letter-spacing:0.02em;">${label}</a>`;
}
