// lib/bulk-email.ts
// Bulk email queue ingestion and processing.
//
// Architecture:
//   - All bulk sends go through EmailQueue first (never inline).
//   - ACS (Azure Communication Services) is the configured bulk provider.
//   - If ACS is not configured, queue functions still write rows but
//     processEmailQueueBatch() returns an error — nothing is sent silently.
//   - Microsoft Graph is NOT used for bulk. Graph = transactional only.
//   - Every queued email respects EmailSuppression and UserPreferences.
//   - Every send attempt is logged in EmailLog.
//
// Caller contract:
//   1. Check user preference before calling enqueueFor*().
//   2. Call enqueueFor*() — this writes EmailQueue rows in safe batches.
//   3. Call processEmailQueueBatch() separately (admin trigger / cron).

import { prisma } from "@/lib/prisma";
import { buildUnsubscribeUrl, buildPreferencesUrl } from "@/lib/unsubscribe";
import type { EmailType, Prisma } from "@prisma/client";

const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM_NAME = "AIM Studio";

// ── ACS configuration check ───────────────────────────────────

export function isAcsConfigured(): boolean {
  return !!(
    process.env.ACS_CONNECTION_STRING &&
    process.env.ACS_SENDER_ADDRESS
  );
}

// ── Base email template (dark cinematic — matches lib/email.ts) ──
// Includes unsubscribe footer on every bulk email.

function bulkBaseTemplate(opts: {
  title:          string;
  bodyHtml:       string;
  recipientEmail: string;
  preheader?:     string;
}): string {
  const unsubUrl   = buildUnsubscribeUrl(opts.recipientEmail);
  const prefsUrl   = buildPreferencesUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:40px 32px;">
        <tr><td>
          <!-- Logo -->
          <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#f9fafb;letter-spacing:-0.3px;">
            AIM<span style="color:#e8c97e;">Studio</span>
          </p>
          <!-- Title -->
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#f9fafb;line-height:1.3;">
            ${opts.title}
          </h1>
          <!-- Body -->
          ${opts.bodyHtml}
          <!-- Divider -->
          <hr style="margin:28px 0;border:none;border-top:1px solid #2a2a2a;">
          <!-- Footer -->
          <p style="margin:0 0 8px;font-size:11px;color:#6b7280;line-height:1.6;">
            You are receiving this email because you have an account on AIM Studio.
          </p>
          <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.6;">
            <a href="${prefsUrl}" style="color:#6b7280;">Manage preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="${unsubUrl}" style="color:#6b7280;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Shared helpers ────────────────────────────────────────────

function htmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Renders a safe, email-client-compatible image block.
 * Only called with http/https URLs (validated at action layer).
 * Falls back gracefully if image fails to load (display:block keeps layout intact).
 */
function safeImageBlock(imageUrl: string | null | undefined, altText: string): string {
  if (!imageUrl) return "";
  return `<img src="${imageUrl}" alt="${htmlEsc(altText)}" width="440"
    style="width:100%;max-width:440px;height:auto;border-radius:4px;
           margin:0 0 20px;display:block;border:0;" />`;
}

// ── Email template builders ───────────────────────────────────

export function buildNewReleaseEmail(opts: {
  recipientEmail: string;
  workTitle:      string;
  workSlug:       string;
  workType:       string;
  genres?:        string[];
  description?:   string | null;
  imageUrl?:      string | null;
}): { subject: string; html: string } {
  const watchHref  = opts.workType === "SERIES"
    ? `${APP_URL}/watch/${opts.workSlug}`
    : `${APP_URL}/watch/${opts.workSlug}?full=1`;
  const detailHref = `${APP_URL}/works/${opts.workSlug}`;
  const typeLabel  = opts.workType === "SERIES" ? "New Series" : "New Release";
  const genreText  = opts.genres?.slice(0, 3).join(" · ") ?? "";

  const body = `
    ${safeImageBlock(opts.imageUrl, opts.workTitle)}
    ${genreText ? `<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#e8c97e;">${genreText}</p>` : ""}
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
      ${opts.description
        ? opts.description.slice(0, 200) + (opts.description.length > 200 ? "…" : "")
        : `${opts.workTitle} is now available to watch on AIM Studio.`}
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td style="padding-right:8px;">
          <a href="${watchHref}"
             style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                    letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;">
            ${opts.workType === "SERIES" ? "Watch Series" : "Watch Now"}
          </a>
        </td>
        <td>
          <a href="${detailHref}"
             style="display:inline-block;color:#e5e7eb;font-size:13px;font-weight:500;
                    text-decoration:none;padding:11px 20px;border:1px solid #3a3a3a;border-radius:3px;">
            View Details
          </a>
        </td>
      </tr>
    </table>`;

  return {
    subject: `${typeLabel}: ${opts.workTitle}`,
    html:    bulkBaseTemplate({
      title:          opts.workTitle,
      bodyHtml:       body,
      recipientEmail: opts.recipientEmail,
      preheader:      `${typeLabel} on AIM Studio — ${opts.workTitle}`,
    }),
  };
}

export function buildNewEpisodeEmail(opts: {
  recipientEmail: string;
  seriesTitle:    string;
  seriesSlug:     string;
  episodeTitle:   string;
  episodeNumber?: number | null;
  seasonNumber?:  number | null;
  imageUrl?:      string | null;
}): { subject: string; html: string } {
  const watchHref  = `${APP_URL}/watch/${opts.seriesSlug}`;
  const epLabel    = opts.seasonNumber && opts.episodeNumber
    ? `S${opts.seasonNumber}E${opts.episodeNumber}`
    : opts.episodeNumber
      ? `Episode ${opts.episodeNumber}`
      : "New Episode";

  const body = `
    ${safeImageBlock(opts.imageUrl, opts.episodeTitle)}
    <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#e8c97e;">
      ${opts.seriesTitle}
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
      ${epLabel} — <em style="color:#e5e7eb;">${opts.episodeTitle}</em> — is now available.
    </p>
    <a href="${watchHref}"
       style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
              letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;">
      Watch Now
    </a>`;

  return {
    subject: `New episode: ${opts.seriesTitle} — ${epLabel}`,
    html:    bulkBaseTemplate({
      title:          `${opts.episodeTitle}`,
      bodyHtml:       body,
      recipientEmail: opts.recipientEmail,
      preheader:      `${epLabel} of ${opts.seriesTitle} is now streaming`,
    }),
  };
}

export function buildAnnouncementEmail(opts: {
  recipientEmail: string;
  title:          string;
  body:           string;
  href?:          string | null;
  hrefLabel?:     string | null;
  imageUrl?:      string | null;
}): { subject: string; html: string } {
  const ctaHtml = opts.href
    ? `<a href="${opts.href}"
           style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                  letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;margin-top:20px;">
          ${opts.hrefLabel ?? "Learn More"}
        </a>`
    : "";

  const bodyHtml = `
    ${safeImageBlock(opts.imageUrl, opts.title)}
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">${opts.body}</p>
    ${ctaHtml}`;

  return {
    subject: opts.title,
    html:    bulkBaseTemplate({
      title:          opts.title,
      bodyHtml,
      recipientEmail: opts.recipientEmail,
      preheader:      opts.title,
    }),
  };
}

export function buildNotifyMeFollowupEmail(opts: {
  recipientEmail: string;
  recipientName?: string | null;
  workTitle:      string;
  workSlug:       string;
  workType:       string;
}): { subject: string; html: string } {
  const watchHref  = opts.workType === "SERIES"
    ? `${APP_URL}/watch/${opts.workSlug}`
    : `${APP_URL}/watch/${opts.workSlug}?full=1`;
  const detailHref = `${APP_URL}/works/${opts.workSlug}`;
  const greeting   = opts.recipientName ? `Hi ${opts.recipientName},` : "It's here.";

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;line-height:1.6;">
      ${greeting} You asked us to let you know when <strong style="color:#e5e7eb;">${opts.workTitle}</strong> was ready.
      It&apos;s ready now.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td style="padding-right:8px;">
          <a href="${watchHref}"
             style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;
                    letter-spacing:0.04em;text-decoration:none;padding:11px 24px;border-radius:3px;">
            ${opts.workType === "SERIES" ? "Watch Series" : "Watch Now"}
          </a>
        </td>
        <td>
          <a href="${detailHref}"
             style="display:inline-block;color:#e5e7eb;font-size:13px;font-weight:500;
                    text-decoration:none;padding:11px 20px;border:1px solid #3a3a3a;border-radius:3px;">
            View Details
          </a>
        </td>
      </tr>
    </table>`;

  return {
    subject: `It's here: ${opts.workTitle}`,
    html:    bulkBaseTemplate({
      title:          opts.workTitle,
      bodyHtml,
      recipientEmail: opts.recipientEmail,
      preheader:      `${opts.workTitle} is now available on AIM Studio`,
    }),
  };
}

// ── Queue ingestion ───────────────────────────────────────────

export async function enqueueBulkEmail(opts: {
  to:          string;
  subject:     string;
  bodyHtml:    string;
  type:        EmailType;
  campaignId?: string;
  scheduledAt?: Date;
  metadata?:   Record<string, unknown>;
}): Promise<void> {
  await prisma.emailQueue.create({
    data: {
      to:          opts.to.toLowerCase().trim(),
      subject:     opts.subject,
      bodyHtml:    opts.bodyHtml,
      type:        opts.type,
      provider:    "ACS",
      status:      "QUEUED",
      campaignId:  opts.campaignId ?? null,
      scheduledAt: opts.scheduledAt ?? new Date(),
      metadata:    opts.metadata != null
        ? (opts.metadata as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

// Bulk-enqueue for a list of recipients.
// Checks EmailSuppression for each address.
// Returns counts: queued / suppressed.

const ENQUEUE_BATCH = 50; // EmailQueue inserts per batch

export async function enqueueBulkForRecipients(opts: {
  recipients: { email: string; name?: string | null }[];
  buildEmail: (recipient: { email: string; name?: string | null }) => { subject: string; html: string };
  type:       EmailType;
  campaignId: string;
}): Promise<{ queued: number; suppressed: number; skipped: number }> {
  let queued = 0;
  let suppressed = 0;
  let skipped = 0;

  // Load all suppressed emails in one query for this batch
  const emails      = opts.recipients.map(r => r.email.toLowerCase().trim());
  const suppressSet = await getSuppressedSet(emails);

  const rows: Prisma.EmailQueueCreateManyInput[] = [];

  for (const recipient of opts.recipients) {
    const norm = recipient.email.toLowerCase().trim();
    if (!norm) { skipped++; continue; }

    if (suppressSet.has(norm)) {
      suppressed++;
      continue;
    }

    let subject: string;
    let bodyHtml: string;
    try {
      const built = opts.buildEmail(recipient);
      subject  = built.subject;
      bodyHtml = built.html;
    } catch {
      skipped++;
      continue;
    }

    rows.push({
      to:         norm,
      subject,
      bodyHtml,
      type:       opts.type,
      provider:   "ACS",
      status:     "QUEUED",
      campaignId: opts.campaignId,
    });
  }

  // Insert in batches
  for (let i = 0; i < rows.length; i += ENQUEUE_BATCH) {
    const batch = rows.slice(i, i + ENQUEUE_BATCH);
    await prisma.emailQueue.createMany({ data: batch, skipDuplicates: false });
    queued += batch.length;
  }

  return { queued, suppressed, skipped };
}

async function getSuppressedSet(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const rows = await prisma.emailSuppression.findMany({
    where: { email: { in: emails }, active: true },
    select: { email: true },
  });
  return new Set(rows.map(r => r.email));
}

// ── Batch processor ───────────────────────────────────────────
// Processes up to `limit` QUEUED items.
// If ACS is not configured: marks all as FAILED and returns an error.
// This is called by admin actions or a cron route — never inline.

export type ProcessResult = {
  processed: number;
  sent:      number;
  failed:    number;
  error?:    string;        // set if ACS is not configured
};

export async function processEmailQueueBatch(limit = 50): Promise<ProcessResult> {
  if (!isAcsConfigured()) {
    return {
      processed: 0,
      sent:      0,
      failed:    0,
      error:     "Bulk email provider (ACS) is not configured. Set ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS.",
    };
  }

  // Claim up to `limit` QUEUED items
  const items = await prisma.emailQueue.findMany({
    where:   { status: "QUEUED", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take:    limit,
  });

  if (items.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent   = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await sendViaAcs({
        to:      item.to,
        subject: item.subject,
        html:    item.bodyHtml,
      });

      await prisma.emailQueue.update({
        where: { id: item.id },
        data:  { status: "SENT", processedAt: new Date(), error: null },
      });

      // Log success
      await logBulkSend({
        to:         item.to,
        subject:    item.subject,
        type:       item.type,
        status:     "SENT",
        campaignId: item.campaignId,
      });

      sent++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      await prisma.emailQueue.update({
        where: { id: item.id },
        data:  {
          status:     item.retryCount + 1 >= item.maxRetries ? "FAILED" : "QUEUED",
          retryCount: { increment: 1 },
          error:      errorMsg,
        },
      });

      // Log failure
      await logBulkSend({
        to:         item.to,
        subject:    item.subject,
        type:       item.type,
        status:     "FAILED",
        error:      errorMsg,
        campaignId: item.campaignId,
      });

      failed++;
    }
  }

  return { processed: items.length, sent, failed };
}

// ── ACS sender ────────────────────────────────────────────────
// Uses @azure/communication-email (installed in Phase 8).
// Dynamic import keeps the package out of any client bundle.
// isAcsConfigured() is always checked before this is called.

const ACS_SEND_TIMEOUT_MS = 30_000; // 30 s per message

async function sendViaAcs(opts: {
  to:      string;
  subject: string;
  html:    string;
}): Promise<void> {
  const connectionString = process.env.ACS_CONNECTION_STRING;
  const senderAddress    = process.env.ACS_SENDER_ADDRESS;

  if (!connectionString || !senderAddress) {
    throw new Error("ACS_CONNECTION_STRING or ACS_SENDER_ADDRESS not set");
  }

  // Dynamic import — @azure/communication-email is Node.js-only.
  // This import never appears in a client bundle.
  const { EmailClient } = await import("@azure/communication-email");

  const client = new EmailClient(connectionString);

  const message = {
    senderAddress,
    content: {
      subject: opts.subject,
      html:    opts.html,
    },
    recipients: {
      to: [{ address: opts.to }],
    },
  };

  const poller = await client.beginSend(message);

  // Poll until the ACS operation completes, with a timeout guard
  const timeoutHandle = setTimeout(() => {
    // pollUntilDone() doesn't expose a cancel — let the caller's
    // try/catch handle the Promise rejection via the outer timeout race
  }, ACS_SEND_TIMEOUT_MS);

  try {
    const result = await Promise.race([
      poller.pollUntilDone(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ACS send timed out")), ACS_SEND_TIMEOUT_MS)
      ),
    ]);

    // ACS returns status "Succeeded" on success; anything else is a failure
    if ("status" in result && result.status !== "Succeeded") {
      throw new Error(`ACS send status: ${result.status}`);
    }
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ── Email log helper for bulk sends ──────────────────────────

async function logBulkSend(opts: {
  to:          string;
  subject:     string;
  type:        EmailType;
  status:      "SENT" | "FAILED";
  error?:      string;
  campaignId?: string | null;
}): Promise<void> {
  try {
    const from = process.env.ACS_SENDER_ADDRESS ?? "bulk@aimstudio.app";
    await prisma.emailLog.create({
      data: {
        to:       opts.to,
        from,
        subject:  opts.subject,
        type:     opts.type,
        provider: "ACS",
        status:   opts.status,
        error:    opts.error ?? null,
        metadata: opts.campaignId ? { campaignId: opts.campaignId } : undefined,
        sentAt:   opts.status === "SENT" ? new Date() : null,
      },
    });
  } catch {
    // logging must never throw
  }
}
