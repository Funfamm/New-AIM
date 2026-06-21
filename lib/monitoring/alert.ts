import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { premiumTransactionalEmail } from "@/lib/email-base";

// Alerting for the in-house error monitor. Three signals: a newly-seen group,
// a regression (a resolved error returned), and a spike (occurrence burst).
// Dedupe is DB-backed (per-fingerprint `lastAlertedAt`) so it holds across all
// serverless instances — unlike the old in-memory cooldown. Delivery is email
// plus an optional Slack-compatible webhook. Nothing here may throw: alerting
// must never crash the app it monitors.

const ALERT_TO    = process.env.ADMIN_ALERT_EMAIL || process.env.GRAPH_EMAIL_SENDER || "";
const WEBHOOK_URL = process.env.ERROR_ALERT_WEBHOOK_URL || "";
const COOLDOWN_MS = Math.max(1, Number(process.env.ERROR_ALERT_COOLDOWN_MIN) || 30) * 60_000;

type AlertKind = "new" | "regression" | "spike";

interface AlertInput {
  fingerprint: string;
  level:       string;
  source?:     string;
  message:     string;
  route:       string | null;
  release?:    string | null;
  count?:      number;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Atomically claim the alert slot for a fingerprint. Only the instance whose
// update matches a row with a null/stale `lastAlertedAt` wins and sends; every
// other instance and repeat occurrence is deduped. Returns false on any error.
async function claimAlertSlot(fingerprint: string): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - COOLDOWN_MS);
    const res = await prisma.errorLog.updateMany({
      where: { fingerprint, OR: [{ lastAlertedAt: null }, { lastAlertedAt: { lt: cutoff } }] },
      data:  { lastAlertedAt: new Date() },
    });
    return res.count === 1;
  } catch {
    return false;
  }
}

const META: Record<AlertKind, { tag: string; title: string; lead: (i: AlertInput) => string; subject: (i: AlertInput) => string }> = {
  new: {
    tag:     "System Alert",
    title:   "New error detected",
    lead:    (i) => `A new <strong style="color:#f9fafb;">${esc(i.level)}</strong> was detected on AIM Studio.`,
    subject: (i) => `[${i.level}] New error on AIM Studio`,
  },
  regression: {
    tag:     "Regression",
    title:   "A resolved error has returned",
    lead:    (i) => `A previously <strong style="color:#f9fafb;">resolved</strong> ${esc(i.level)} has recurred${i.release ? ` on release <strong style="color:#f9fafb;">${esc(i.release)}</strong>` : ""}.`,
    subject: (i) => `[${i.level}] Regression on AIM Studio`,
  },
  spike: {
    tag:     "Spike",
    title:   "Error spike detected",
    lead:    (i) => `An error is spiking — <strong style="color:#f9fafb;">${i.count ?? "many"}</strong> occurrences in the last hour.`,
    subject: (i) => `[${i.level}] Error spike on AIM Studio (${i.count ?? "?"}/hr)`,
  },
};

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://impactaistudio.com").replace(/\/$/, "");
}

async function emailAlert(kind: AlertKind, i: AlertInput): Promise<void> {
  if (!ALERT_TO) return;
  const m = META[kind];
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">${m.lead(i)}</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;width:100%;font-size:13px;color:#d1d5db;">
      ${i.source ? `<tr><td style="padding:5px 0;color:#6b7280;width:90px;">Source</td><td style="padding:5px 0;">${esc(i.source)}</td></tr>` : ""}
      ${i.route ? `<tr><td style="padding:5px 0;color:#6b7280;">Route</td><td style="padding:5px 0;">${esc(i.route)}</td></tr>` : ""}
      ${i.release ? `<tr><td style="padding:5px 0;color:#6b7280;">Release</td><td style="padding:5px 0;">${esc(i.release)}</td></tr>` : ""}
      <tr><td style="padding:5px 0;color:#6b7280;vertical-align:top;">Message</td><td style="padding:5px 0;color:#f3f4f6;">${esc(i.message)}</td></tr>
    </table>
    <a href="${appUrl()}/admin/errors"
       style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
              letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">
      View in Admin
    </a>
    <p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
      Further occurrences of this error are aggregated; you will not be re-alerted for each one.
    </p>`;

  await sendEmail({
    to:      ALERT_TO,
    subject: m.subject(i),
    html:    premiumTransactionalEmail({ label: m.tag, title: m.title, bodyHtml }),
    type:    "ADMIN_ALERT",
  });
}

// Slack-compatible incoming-webhook payload. No-op unless ERROR_ALERT_WEBHOOK_URL is set.
async function webhookAlert(kind: AlertKind, i: AlertInput): Promise<void> {
  if (!WEBHOOK_URL) return;
  try {
    const lines = [
      `*${META[kind].subject(i)}*`,
      i.source  ? `Source: ${i.source}`   : null,
      i.route   ? `Route: ${i.route}`     : null,
      i.release ? `Release: ${i.release}` : null,
      `Message: ${i.message.slice(0, 500)}`,
      `<${appUrl()}/admin/errors|View in Admin>`,
    ].filter(Boolean);

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    await fetch(WEBHOOK_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text: lines.join("\n") }),
      signal:  ctrl.signal,
    }).catch(() => {});
    clearTimeout(timer);
  } catch {
    // webhook must never throw
  }
}

async function dispatch(kind: AlertKind, i: AlertInput): Promise<void> {
  try {
    if (!(await claimAlertSlot(i.fingerprint))) return;
    await Promise.allSettled([emailAlert(kind, i), webhookAlert(kind, i)]);
  } catch {
    // alerting must never throw
  }
}

export function alertNewError(i: AlertInput):  void { void dispatch("new", i); }
export function alertRegression(i: AlertInput): void { void dispatch("regression", i); }
export function alertSpike(i: AlertInput):      void { void dispatch("spike", i); }
