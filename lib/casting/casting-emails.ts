import "server-only";
import { sendEmail } from "@/lib/email";
import { premiumTransactionalEmail } from "@/lib/email-base";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type BaseArgs = {
  to:         string;
  name:       string;
  roleTitle:  string;
  posterUrl?: string | null;
};

// ── HTML helpers ──────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">${text}</p>`;
}

function note(text: string): string {
  return `<p style="margin:16px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">${text}</p>`;
}

function cta(href: string, label: string): string {
  return `<a href="${href}"
     style="display:inline-block;margin-top:4px;padding:12px 28px;background:#e8c97e;
            color:#0a0a0a;font-weight:700;font-size:13px;border-radius:3px;
            text-decoration:none;letter-spacing:0.04em;">
    ${label}
  </a>`;
}

// Wraps the casting body HTML in the shared premium layout.
// Uses premiumTransactionalEmail (transactional — no unsubscribe footer).
function castingEmail(title: string, bodyHtml: string, label = "Casting", imageUrl?: string | null): string {
  return premiumTransactionalEmail({ title, bodyHtml, label, imageUrl: imageUrl ?? undefined });
}

// ── 1. Application received ───────────────────────────────────

export async function sendCastingReceived(args: BaseArgs & { trackingToken: string }) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;
  await sendEmail({
    to:      args.to,
    subject: "We received your casting application — AIM Studio",
    type:    "CASTING_RECEIVED",
    html:    castingEmail(
      `Application received`,
      `
      ${p(`Hi ${esc(args.name)},`)}
      ${p(`Thank you for applying for the role of <strong style="color:#e5e7eb;">${esc(args.roleTitle)}</strong>. Your application has been received and is currently under review.`)}
      ${p("You can track the status of your application at any time using the link below.")}
      ${cta(trackUrl, "Track My Application")}
      ${note("You will receive an email when your application status changes.")}
      `,
      "Casting",
      args.posterUrl,
    ),
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 2. Requirements not met ───────────────────────────────────

export async function sendCastingRequirementsNotMet(
  args: BaseArgs & { reasons: string[]; trackingToken: string; canResubmit: boolean },
) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;

  const reasonList = args.reasons.length > 0
    ? `<ul style="margin:8px 0 16px;padding-left:20px;">
        ${args.reasons.map((r) => `<li style="margin-bottom:8px;font-size:14px;color:#9ca3af;line-height:1.6;">${esc(r)}</li>`).join("")}
       </ul>`
    : "";

  const resubmitSection = args.canResubmit
    ? `${p("You may update and resubmit your application. Please ensure all required materials are included before resubmitting.")}
       ${cta(trackUrl, "View My Application")}`
    : `${note("If you believe this is in error or have questions, please contact us through the site.")}`;

  await sendEmail({
    to:      args.to,
    subject: "Action needed on your casting application — AIM Studio",
    type:    "CASTING_REQUIREMENTS_NOT_MET",
    html:    castingEmail(
      "Review required",
      `
      ${p(`Hi ${esc(args.name)},`)}
      ${p(`Thank you for your interest in the role of <strong style="color:#e5e7eb;">${esc(args.roleTitle)}</strong>. After reviewing your submission, we found that it does not currently meet the review requirements.`)}
      ${reasonList ? `<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Please review the following:</p>${reasonList}` : ""}
      ${resubmitSection}
      ${note("We appreciate your time and interest in working with AIM Studio.")}
      `,
      "Casting",
      args.posterUrl,
    ),
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 3. Ready for admin review (admin notification) ────────────

export async function sendCastingReadyForReview(args: {
  adminEmail:     string;
  applicantName:  string;
  roleTitle:      string;
  applicationId:  string;
  score:          number;
  posterUrl?:     string | null;
}) {
  const adminUrl = `${APP_URL}/admin/casting/${args.applicationId}`;
  await sendEmail({
    to:      args.adminEmail,
    subject: `Casting submission ready for review — ${args.roleTitle}`,
    type:    "CASTING_READY_FOR_REVIEW",
    html:    castingEmail(
      "New submission ready for review",
      `
      ${p("A casting application has passed agent review and is ready for your decision.")}
      <table cellpadding="0" cellspacing="0" role="presentation"
             style="margin:0 0 20px;padding:16px 20px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;width:100%;">
        <tr>
          <td style="padding:5px 0;">
            <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Applicant</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:#f9fafb;">${esc(args.applicantName)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0 5px;">
            <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Role</p>
            <p style="margin:0;font-size:14px;color:#e5e7eb;">${esc(args.roleTitle)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0 0;">
            <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Agent Score</p>
            <p style="margin:0;font-size:20px;font-weight:700;color:#e8c97e;">${args.score} / 100</p>
          </td>
        </tr>
      </table>
      ${cta(adminUrl, "Review Application")}
      `,
      "Admin — Casting",
      args.posterUrl,
    ),
    metadata: { roleTitle: args.roleTitle, score: args.score },
  });
}

// ── 4. Shortlisted ────────────────────────────────────────────

export async function sendCastingShortlisted(args: BaseArgs & { trackingToken: string }) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;
  await sendEmail({
    to:      args.to,
    subject: "You have been shortlisted — AIM Studio",
    type:    "CASTING_SHORTLISTED",
    html:    castingEmail(
      "You have been shortlisted",
      `
      ${p(`Hi ${esc(args.name)},`)}
      ${p(`We are pleased to let you know that your application for <strong style="color:#e5e7eb;">${esc(args.roleTitle)}</strong> has been shortlisted by our team.`)}
      ${p("Our team will be in touch with you soon regarding next steps. Please keep an eye on your inbox.")}
      ${cta(trackUrl, "View Application Status")}
      `,
      "Casting",
      args.posterUrl,
    ),
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 5. Contacted ──────────────────────────────────────────────

export async function sendCastingContacted(args: BaseArgs & { trackingToken: string; message?: string }) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;
  await sendEmail({
    to:      args.to,
    subject: `AIM Studio is reaching out — ${args.roleTitle}`,
    type:    "CASTING_CONTACTED",
    html:    castingEmail(
      "We are reaching out",
      `
      ${p(`Hi ${esc(args.name)},`)}
      ${p(`The AIM Studio casting team has reached out regarding your application for <strong style="color:#e5e7eb;">${esc(args.roleTitle)}</strong>.`)}
      ${args.message ? p(esc(args.message)) : ""}
      ${note("Please respond through the contact channel our team used to reach you.")}
      ${cta(trackUrl, "View Application Status")}
      `,
      "Casting",
      args.posterUrl,
    ),
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 6. Selected ───────────────────────────────────────────────

export async function sendCastingSelected(args: BaseArgs & { trackingToken: string }) {
  const trackUrl = `${APP_URL}/casting/applications/track/${args.trackingToken}`;
  await sendEmail({
    to:      args.to,
    subject: "Congratulations — you have been selected — AIM Studio",
    type:    "CASTING_SELECTED",
    html:    castingEmail(
      "Congratulations",
      `
      ${p(`Hi ${esc(args.name)},`)}
      ${p(`Congratulations. You have been selected for the role of <strong style="color:#e5e7eb;">${esc(args.roleTitle)}</strong> at AIM Studio.`)}
      ${p("Our team will contact you shortly with details on next steps and production logistics. Please continue to monitor your inbox and the casting portal.")}
      ${cta(trackUrl, "View Application Status")}
      ${note("We look forward to working with you.")}
      `,
      "Casting",
      args.posterUrl,
    ),
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 7. Not selected ───────────────────────────────────────────

export async function sendCastingNotSelected(args: BaseArgs) {
  await sendEmail({
    to:      args.to,
    subject: "Thank you for applying — AIM Studio",
    type:    "CASTING_NOT_SELECTED",
    html:    castingEmail(
      "Thank you for applying",
      `
      ${p(`Hi ${esc(args.name)},`)}
      ${p(`Thank you for applying for the role of <strong style="color:#e5e7eb;">${esc(args.roleTitle)}</strong>. We genuinely appreciate the time and effort you put into your application.`)}
      ${p("After careful consideration, we have decided to move forward with another candidate for this particular role. This decision reflects the specific requirements of this production and is not a reflection of your talent.")}
      ${note("We encourage you to follow AIM Studio for future casting opportunities.")}
      `,
      "Casting",
      args.posterUrl,
    ),
    metadata: { roleTitle: args.roleTitle },
  });
}

// ── 8. Withdrawn ──────────────────────────────────────────────

export async function sendCastingWithdrawn(args: BaseArgs) {
  await sendEmail({
    to:      args.to,
    subject: "Your casting application has been withdrawn — AIM Studio",
    type:    "CASTING_WITHDRAWN",
    html:    castingEmail(
      "Application withdrawn",
      `
      ${p(`Hi ${esc(args.name)},`)}
      ${p(`This confirms that your application for <strong style="color:#e5e7eb;">${esc(args.roleTitle)}</strong> has been successfully withdrawn.`)}
      ${note("Thank you for your interest in AIM Studio. We hope to see you apply for future roles.")}
      `,
      "Casting",
      args.posterUrl,
    ),
    metadata: { roleTitle: args.roleTitle },
  });
}
