// lib/bulk-email.ts
// Bulk email queue ingestion and processing.
//
// Architecture:
//   - All bulk sends go through EmailQueue first (never inline).
//   - Active bulk provider is configured in AdminSettings.primaryBulkProvider.
//     Admin selects: "graph" | "acs" | "smtp" in /admin/email?tab=settings.
//   - Microsoft Graph can handle bulk while ACS domain is not yet verified.
//   - ACS is the preferred long-term bulk provider (announcements, campaigns).
//   - SMTP is an emergency fallback — currently not fully implemented.
//   - If selected provider is not configured, sends fail with a clear error.
//   - Every queued email respects EmailSuppression and UserPreferences.
//   - Every send attempt is logged in EmailLog.
//
// Caller contract:
//   1. Call checkSelectedBulkProvider() to verify the active provider is ready.
//   2. Check user preference before calling enqueueFor*().
//   3. Call enqueueFor*() — this writes EmailQueue rows in safe batches.
//   4. Call processEmailQueueBatch() separately (admin trigger / cron).

import { prisma } from "@/lib/prisma";
import { buildUnsubscribeUrl, buildPreferencesUrl } from "@/lib/unsubscribe";
import { generateTrackingToken, injectTrackingPixel, wrapLinksWithTracking } from "@/lib/email-tracking";
import type { EmailType, EmailProvider, Prisma } from "@prisma/client";

const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM_NAME = "AIM Studio";

// Kept for backward compatibility — callers in outreach.ts and compose-form.tsx import this type.
// The new release builder uses hasTrailer/hasPreview/hasVideo flags instead.
export type ReleaseStage = "coming_soon" | "trailer_out" | "now_streaming";

// ── Provider configuration checks ────────────────────────────

export function isAcsConfigured(): boolean {
  return !!(process.env.ACS_CONNECTION_STRING && process.env.ACS_SENDER_ADDRESS);
}

export function isGraphConfigured(): boolean {
  return !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.GRAPH_EMAIL_SENDER
  );
}

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}

// ── Active provider readiness check ──────────────────────────
// Reads AdminSettings.primaryBulkProvider and validates the selected
// provider is configured. Returns a clear error if not ready.
// Use this in outreach actions instead of isAcsConfigured() directly.

export async function checkSelectedBulkProvider(): Promise<{
  ok:       boolean;
  provider: string;
  error?:   string;
}> {
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: { primaryBulkProvider: true },
  });
  const provider = ((settings?.primaryBulkProvider ?? "acs").toLowerCase()) as "acs" | "graph" | "smtp";

  if (provider === "acs" && !isAcsConfigured()) {
    return {
      ok: false, provider,
      error: "Bulk provider is set to ACS but ACS_CONNECTION_STRING / ACS_SENDER_ADDRESS are not configured. Switch to Graph in Email Settings.",
    };
  }
  if (provider === "graph" && !isGraphConfigured()) {
    return {
      ok: false, provider,
      error: "Bulk provider is set to Graph but Microsoft Graph credentials are not configured. Check AZURE_CLIENT_ID, AZURE_TENANT_ID, GRAPH_EMAIL_SENDER.",
    };
  }
  if (provider === "smtp") {
    if (!isSmtpConfigured()) {
      return {
        ok: false, provider,
        error: "Bulk provider is set to SMTP but SMTP_HOST / SMTP_USER are not configured.",
      };
    }
    // SMTP is detected as configured but sending is not yet implemented
    return {
      ok: false, provider,
      error: "SMTP bulk sending is not yet implemented. Select ACS or Graph in Email Settings.",
    };
  }
  return { ok: true, provider };
}

// ── Shared helpers ────────────────────────────────────────────

function htmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function goldBtn(label: string, href: string): string {
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

// ── Premium bulk email wrapper ────────────────────────────────
// 600px dark card with gold header border and unsubscribe footer.
// Images are passed as a dedicated option and rendered full-bleed
// between the header and content area.

function bulkBaseTemplate(opts: {
  title:          string;
  bodyHtml:       string;
  recipientEmail: string;
  preheader?:     string;
  imageUrl?:      string | null;
  label?:         string;         // e.g. "New Release", "Coming Soon" — gold caps above title
}): string {
  const unsubUrl = buildUnsubscribeUrl(opts.recipientEmail);
  const prefsUrl = buildPreferencesUrl();

  const preheaderDiv = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : "";

  const imageRow = opts.imageUrl
    ? `<tr><td style="padding:0;font-size:0;line-height:0;">
         <img src="${htmlEsc(opts.imageUrl)}" alt="${htmlEsc(opts.title)}" width="598"
              style="width:100%;max-width:598px;height:auto;display:block;border:0;" />
       </td></tr>`
    : "";

  const labelRow = opts.label
    ? `<p style="margin:0 0 6px;font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#e8c97e;">${htmlEsc(opts.label)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${htmlEsc(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  ${preheaderDiv}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;background:#111111;border:1px solid #2a2a2a;border-radius:8px;">

        <!-- ── Header ─────────────────────────────────────── -->
        <tr><td style="padding:22px 32px;border-bottom:2px solid #e8c97e;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#f9fafb;letter-spacing:-0.4px;">
            AIM<span style="color:#e8c97e;">Studio</span>
          </p>
        </td></tr>

        ${imageRow}

        <!-- ── Content ────────────────────────────────────── -->
        <tr><td style="padding:32px 32px 28px;">
          ${labelRow}
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#f9fafb;line-height:1.3;">${htmlEsc(opts.title)}</h1>
          ${opts.bodyHtml}
        </td></tr>

        <!-- ── Footer ─────────────────────────────────────── -->
        <tr><td style="padding:18px 32px;background:#0a0a0a;border-top:1px solid #1a1a1a;border-radius:0 0 8px 8px;">
          <p style="margin:0 0 5px;font-size:11px;color:#4b5563;line-height:1.6;letter-spacing:0.03em;">
            AIM Studio &nbsp;&middot;&nbsp; Don&rsquo;t look away.
          </p>
          <p style="margin:0;font-size:11px;color:#374151;line-height:1.6;">
            <a href="${prefsUrl}" style="color:#4b5563;text-decoration:underline;">Manage preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="${unsubUrl}" style="color:#4b5563;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
  // Media presence flags — determines CTA label and link
  hasTrailer?:    boolean;        // trailerUrl is set on the work
  hasPreview?:    boolean;        // previewClipUrl is set on the work
  hasVideo?:      boolean;        // videoUrl is set on the work (full film/series)
  // Legacy — kept for backward compatibility, ignored when has* flags are provided
  releaseStage?:  "coming_soon" | "trailer_out" | "now_streaming";
}): { subject: string; html: string } {
  const watchHref  = `${APP_URL}/watch/${opts.workSlug}`;
  const detailHref = `${APP_URL}/works/${opts.workSlug}`;
  const isSeries   = opts.workType === "SERIES";
  const typeLabel  = isSeries ? "New Series" : "New Release";
  const genreText  = opts.genres?.slice(0, 3).join(" · ") ?? "";
  const descText   = opts.description
    ? opts.description.slice(0, 220) + (opts.description.length > 220 ? "…" : "")
    : null;

  // ── CTA priority: trailer > preview > full video > details ──
  let ctaLabel:    string;
  let ctaPrimary:  string;
  let showSecondary = true;

  if (opts.hasTrailer) {
    ctaLabel   = "Watch Trailer";
    ctaPrimary = watchHref;
  } else if (opts.hasPreview) {
    ctaLabel   = "Watch Preview";
    ctaPrimary = watchHref;
  } else if (opts.hasVideo) {
    ctaLabel   = isSeries ? "Watch Series" : "Watch Full Film";
    ctaPrimary = watchHref;
  } else {
    // Fallback: check legacy releaseStage, then default to View Details
    const stage = opts.releaseStage ?? "coming_soon";
    if (stage === "trailer_out") {
      ctaLabel   = "Watch Trailer";
      ctaPrimary = watchHref;
    } else if (stage === "now_streaming") {
      ctaLabel   = isSeries ? "Watch Series" : "Watch Now";
      ctaPrimary = watchHref;
    } else {
      ctaLabel      = "View Details";
      ctaPrimary    = detailHref;
      showSecondary = false;
    }
  }

  const subject   = ctaLabel === "View Details"
    ? `Coming Soon: ${opts.workTitle}`
    : ctaLabel === "Watch Trailer"
      ? `Watch the Trailer: ${opts.workTitle}`
      : `${typeLabel}: ${opts.workTitle}`;

  const preheader = ctaLabel === "View Details"
    ? `Coming soon to AIM Studio — ${opts.workTitle}`
    : `${typeLabel} on AIM Studio — ${opts.workTitle}`;

  const ctaRow = `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0 0;">
      <tr>
        <td style="padding-right:10px;">${goldBtn(ctaLabel, ctaPrimary)}</td>
        ${showSecondary ? `<td>${ghostBtn("View Details", detailHref)}</td>` : ""}
      </tr>
    </table>`;

  const bodyHtml = `
    ${genreText ? `<p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">${htmlEsc(genreText)}</p>` : ""}
    <p style="margin:0 0 8px;font-size:14px;color:#9ca3af;line-height:1.7;">${descText ? htmlEsc(descText) : `${htmlEsc(opts.workTitle)} is now available on AIM Studio.`}</p>
    ${ctaRow}`;

  return {
    subject,
    html: bulkBaseTemplate({
      title:          opts.workTitle,
      bodyHtml,
      recipientEmail: opts.recipientEmail,
      preheader,
      imageUrl:       opts.imageUrl,
      label:          ctaLabel === "View Details" ? "Coming Soon" : typeLabel,
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
  const watchHref = `${APP_URL}/watch/${opts.seriesSlug}`;
  const epLabel   = opts.seasonNumber && opts.episodeNumber
    ? `S${opts.seasonNumber}E${opts.episodeNumber}`
    : opts.episodeNumber
      ? `Episode ${opts.episodeNumber}`
      : "New Episode";

  const bodyHtml = `
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">${htmlEsc(opts.seriesTitle)}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;line-height:1.7;">
      ${htmlEsc(epLabel)} &mdash; <em style="color:#e5e7eb;">${htmlEsc(opts.episodeTitle)}</em>
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.7;">
      A new episode of <strong style="color:#e5e7eb;">${htmlEsc(opts.seriesTitle)}</strong> is now available.
    </p>
    <div>${goldBtn("Watch Now", watchHref)}</div>`;

  return {
    subject: `New episode: ${opts.seriesTitle} — ${epLabel}`,
    html:    bulkBaseTemplate({
      title:          `${opts.episodeTitle}`,
      bodyHtml,
      recipientEmail: opts.recipientEmail,
      preheader:      `${epLabel} of ${opts.seriesTitle} is now streaming`,
      imageUrl:       opts.imageUrl,
      label:          "New Episode",
    }),
  };
}

export function buildSeasonDropEmail(opts: {
  recipientEmail: string;
  seriesTitle:    string;
  seriesSlug:     string;
  seasonNumber:   number;
  episodeCount:   number;
  imageUrl?:      string | null;
}): { subject: string; html: string } {
  const watchHref   = `${APP_URL}/watch/${opts.seriesSlug}`;
  const detailHref  = `${APP_URL}/works/${opts.seriesSlug}`;
  const seasonLabel = `Season ${opts.seasonNumber}`;
  const epText      = `${opts.episodeCount} episode${opts.episodeCount === 1 ? "" : "s"}`;

  const bodyHtml = `
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">${htmlEsc(opts.seriesTitle)}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.7;">
      ${htmlEsc(seasonLabel)} is now streaming &mdash; ${htmlEsc(epText)} available.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding-right:10px;">${goldBtn(`Watch ${seasonLabel}`, watchHref)}</td>
        <td>${ghostBtn("View Details", detailHref)}</td>
      </tr>
    </table>`;

  return {
    subject: `${opts.seriesTitle} — ${seasonLabel} is now streaming`,
    html:    bulkBaseTemplate({
      title:          `${opts.seriesTitle} — ${seasonLabel}`,
      bodyHtml,
      recipientEmail: opts.recipientEmail,
      preheader:      `${seasonLabel} of ${opts.seriesTitle} — ${epText} now streaming`,
      imageUrl:       opts.imageUrl,
      label:          "Now Streaming",
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
    ? `<div style="margin:20px 0 0;">${goldBtn(opts.hrefLabel ?? "Learn More", opts.href)}</div>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.7;">${opts.body}</p>
    ${ctaHtml}`;

  return {
    subject: opts.title,
    html:    bulkBaseTemplate({
      title:          opts.title,
      bodyHtml,
      recipientEmail: opts.recipientEmail,
      preheader:      opts.title,
      imageUrl:       opts.imageUrl,
      label:          "From the Studio",
    }),
  };
}

export function buildNotifyMeFollowupEmail(opts: {
  recipientEmail: string;
  recipientName?: string | null;
  workTitle:      string;
  workSlug:       string;
  workType:       string;
  imageUrl?:      string | null;
  hasTrailer?:    boolean;
  hasPreview?:    boolean;
  hasVideo?:      boolean;
}): { subject: string; html: string } {
  const watchHref  = `${APP_URL}/watch/${opts.workSlug}`;
  const detailHref = `${APP_URL}/works/${opts.workSlug}`;
  const greeting   = opts.recipientName ? `Hi ${htmlEsc(opts.recipientName)},` : "It&rsquo;s here.";

  // CTA priority same as new release
  let ctaLabel: string;
  let ctaHref:  string;
  let showSecondary = true;

  if (opts.hasTrailer) {
    ctaLabel = "Watch Trailer";
    ctaHref  = watchHref;
  } else if (opts.hasPreview) {
    ctaLabel = "Watch Preview";
    ctaHref  = watchHref;
  } else if (opts.hasVideo) {
    ctaLabel      = opts.workType === "SERIES" ? "Watch Series" : "Watch Now";
    ctaHref       = watchHref;
  } else {
    ctaLabel      = "View Details";
    ctaHref       = detailHref;
    showSecondary = false;
  }

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;color:#9ca3af;line-height:1.7;">
      ${greeting} You asked us to let you know when <strong style="color:#e5e7eb;">${htmlEsc(opts.workTitle)}</strong> was ready.
      It&rsquo;s ready now.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding-right:10px;">${goldBtn(ctaLabel, ctaHref)}</td>
        ${showSecondary ? `<td>${ghostBtn("View Details", detailHref)}</td>` : ""}
      </tr>
    </table>`;

  return {
    subject: `It's here: ${opts.workTitle}`,
    html:    bulkBaseTemplate({
      title:          opts.workTitle,
      bodyHtml,
      recipientEmail: opts.recipientEmail,
      preheader:      `${opts.workTitle} is now available on AIM Studio`,
      imageUrl:       opts.imageUrl,
      label:          "You asked us to let you know.",
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
  recipients:  { email: string; name?: string | null }[];
  buildEmail:  (recipient: { email: string; name?: string | null }) => { subject: string; html: string };
  type:        EmailType;
  campaignId:  string;
  scheduledAt?: Date;
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
      to:          norm,
      subject,
      bodyHtml,
      type:        opts.type,
      provider:    "ACS",
      status:      "QUEUED",
      campaignId:  opts.campaignId,
      scheduledAt: opts.scheduledAt ?? new Date(),
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
// Processes up to `limit` QUEUED items using whichever bulk provider
// is selected in AdminSettings.primaryBulkProvider (acs | graph | smtp).
// Called by admin actions or a cron route — never inline.

export type ProcessResult = {
  processed: number;
  sent:      number;
  failed:    number;
  error?:    string;
};

export async function processEmailQueueBatch(limit = 50): Promise<ProcessResult> {
  // Resolve the active bulk provider from AdminSettings
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: { primaryBulkProvider: true },
  });

  const providerKey = ((settings?.primaryBulkProvider ?? "acs").toLowerCase()) as "acs" | "graph" | "smtp";

  // Validate that the selected provider is configured
  if (providerKey === "acs" && !isAcsConfigured()) {
    return {
      processed: 0, sent: 0, failed: 0,
      error: "Bulk provider is set to ACS but ACS_CONNECTION_STRING / ACS_SENDER_ADDRESS are not set.",
    };
  }
  if (providerKey === "graph" && !isGraphConfigured()) {
    return {
      processed: 0, sent: 0, failed: 0,
      error: "Bulk provider is set to Graph but AZURE_CLIENT_ID / AZURE_TENANT_ID / GRAPH_EMAIL_SENDER are not set.",
    };
  }
  if (providerKey === "smtp" && !isSmtpConfigured()) {
    return {
      processed: 0, sent: 0, failed: 0,
      error: "Bulk provider is set to SMTP but SMTP_HOST / SMTP_USER are not set.",
    };
  }

  const logProvider: EmailProvider =
    providerKey === "graph" ? "GRAPH" :
    providerKey === "smtp"  ? "SMTP"  : "ACS";

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
    const trackingToken = generateTrackingToken();
    const trackedHtml   = injectTrackingPixel(wrapLinksWithTracking(item.bodyHtml, trackingToken), trackingToken);

    try {
      if (providerKey === "acs") {
        await sendViaAcs({ to: item.to, subject: item.subject, html: trackedHtml });
      } else if (providerKey === "graph") {
        await sendViaBulkGraph({ to: item.to, subject: item.subject, html: trackedHtml });
      } else {
        throw new Error("SMTP bulk sending requires additional server configuration. Switch to ACS or Graph.");
      }

      await prisma.emailQueue.update({
        where: { id: item.id },
        data:  { status: "SENT", processedAt: new Date(), error: null, provider: logProvider },
      });

      await logBulkSend({
        to: item.to, subject: item.subject, type: item.type,
        status: "SENT", campaignId: item.campaignId, provider: logProvider, trackingToken,
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

      await logBulkSend({
        to: item.to, subject: item.subject, type: item.type,
        status: "FAILED", error: errorMsg, campaignId: item.campaignId, provider: logProvider,
      });

      failed++;
    }
  }

  return { processed: items.length, sent, failed };
}

// ── Microsoft Graph bulk sender ──────────────────────────────
// Reuses the same Graph API as transactional email (lib/email.ts)
// but is a self-contained copy to avoid circular imports.
// isGraphConfigured() is always checked before this is called.

async function sendViaBulkGraph(opts: {
  to: string; subject: string; html: string;
}): Promise<void> {
  const clientId     = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;
  const tenantId     = process.env.AZURE_TENANT_ID!;
  const from         = process.env.GRAPH_EMAIL_SENDER!;

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );
  if (!tokenRes.ok) throw new Error(`Graph token failed: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json() as { access_token: string };

  const mailRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject:      opts.subject,
          body:         { contentType: "HTML", content: opts.html },
          toRecipients: [{ emailAddress: { address: opts.to } }],
          from:         { emailAddress: { address: from, name: FROM_NAME } },
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
  to:            string;
  subject:       string;
  type:          EmailType;
  status:        "SENT" | "FAILED";
  error?:        string;
  campaignId?:   string | null;
  provider?:     EmailProvider;
  trackingToken?: string;
}): Promise<void> {
  try {
    const provider = opts.provider ?? "ACS";
    const from = provider === "GRAPH"
      ? (process.env.GRAPH_EMAIL_SENDER ?? "noreply@aimstudio.app")
      : (process.env.ACS_SENDER_ADDRESS ?? "bulk@aimstudio.app");

    await prisma.emailLog.create({
      data: {
        to:            opts.to,
        from,
        subject:       opts.subject,
        type:          opts.type,
        provider,
        status:        opts.status,
        error:         opts.error ?? null,
        metadata:      opts.campaignId ? { campaignId: opts.campaignId } : undefined,
        trackingToken: opts.trackingToken ?? null,
        sentAt:        opts.status === "SENT" ? new Date() : null,
      },
    });
  } catch {
    // logging must never throw
  }
}
