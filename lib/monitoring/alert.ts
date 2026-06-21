import "server-only";
import { sendEmail } from "@/lib/email";
import { premiumTransactionalEmail } from "@/lib/email-base";

// Email alert for newly-seen ERROR/FATAL groups. Fires only on a NEW fingerprint
// (the capture helper only calls this on INSERT, not on increment), and is further
// throttled so a burst of distinct new errors can't flood the inbox.

const ALERT_TO        = process.env.ADMIN_ALERT_EMAIL || process.env.GRAPH_EMAIL_SENDER || "";
const COOLDOWN_MS     = 60_000;   // at most one alert email per minute per instance
let   lastAlertAt     = 0;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function alertNewError(opts: {
  level:   string;
  source:  string;
  message: string;
  route:   string | null;
}): Promise<void> {
  try {
    if (!ALERT_TO) return;
    const now = Date.now();
    if (now - lastAlertAt < COOLDOWN_MS) return;
    lastAlertAt = now;

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://impactaistudio.com").replace(/\/$/, "");

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
        A new <strong style="color:#f9fafb;">${esc(opts.level)}</strong> was detected on AIM Studio.
      </p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;width:100%;font-size:13px;color:#d1d5db;">
        <tr><td style="padding:5px 0;color:#6b7280;width:90px;">Source</td><td style="padding:5px 0;">${esc(opts.source)}</td></tr>
        ${opts.route ? `<tr><td style="padding:5px 0;color:#6b7280;">Route</td><td style="padding:5px 0;">${esc(opts.route)}</td></tr>` : ""}
        <tr><td style="padding:5px 0;color:#6b7280;vertical-align:top;">Message</td><td style="padding:5px 0;color:#f3f4f6;">${esc(opts.message)}</td></tr>
      </table>
      <a href="${appUrl}/admin/errors"
         style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
        View in Admin
      </a>
      <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
        Further occurrences of this error are aggregated; you will not be re-emailed for each one.
      </p>`;

    await sendEmail({
      to:      ALERT_TO,
      subject: `[${opts.level}] New error on AIM Studio`,
      html:    premiumTransactionalEmail({ label: "System Alert", title: "New error detected", bodyHtml }),
      type:    "ADMIN_ALERT",
    });
  } catch {
    // alerting must never throw
  }
}
