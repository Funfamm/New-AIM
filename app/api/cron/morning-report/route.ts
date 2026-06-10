/**
 * POST /api/cron/morning-report  (Vercel Cron — fires at 08:00 UTC daily)
 *
 * Sends the Good Morning system digest email to every admin, and creates an
 * in-app SYSTEM notification so the bell count in the sidebar increments.
 *
 * Set CRON_SECRET in your Vercel environment variables.
 * Schedule: "0 8 * * *"
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function getStats(since: Date) {
  const dayStart    = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const stuckCutoff = new Date(Date.now() - 15 * 60_000);

  const [
    newUsers, totalUsers, newLikes, newShares, newSignups,
    watchCompletions, openAlerts, emailFailures, totalPublished, newWorks, pageViews,
    videoPending, videoFailed, videoStuck,
    subFailed,
    keyInvalid,
    newUnsubscribes, newBounces, newComplaints, newManualSuppressions,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since }, status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.workLike.count({ where: { createdAt: { gte: since } } }),
    prisma.analyticsEvent.count({ where: { type: "SHARE_WORK", createdAt: { gte: since } } }),
    prisma.notifyMeSignup.count({ where: { createdAt: { gte: since } } }),
    prisma.watchProgress.count({ where: { completed: true, updatedAt: { gte: since } } }),
    prisma.securityAlert.count({ where: { status: "OPEN" } }),
    prisma.emailQueue.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    prisma.work.count({ where: { status: "PUBLISHED", type: { not: "EPISODE" } } }),
    prisma.work.count({ where: { createdAt: { gte: since }, type: { not: "EPISODE" } } }),
    prisma.analyticsEvent.count({ where: { type: "PAGE_VIEW", createdAt: { gte: since } } }),
    prisma.videoProcessingJob.count({ where: { status: "PENDING" } }),
    prisma.videoProcessingJob.count({ where: { status: "FAILED" } }),
    prisma.videoProcessingJob.count({ where: { status: "PROCESSING", updatedAt: { lt: stuckCutoff } } }),
    prisma.subtitleJob.count({ where: { status: "FAILED" } }),
    prisma.translationApiKey.count({
      where: { OR: [{ status: "INVALID" }, { status: "DISABLED" }, { isEnabled: false }] },
    }),
    prisma.emailSuppression.count({ where: { reason: "unsubscribe", createdAt: { gte: since } } }),
    prisma.emailSuppression.count({ where: { reason: "bounce",      createdAt: { gte: since } } }),
    prisma.emailSuppression.count({ where: { reason: "complaint",   createdAt: { gte: since } } }),
    prisma.emailSuppression.count({ where: { reason: "manual",      createdAt: { gte: since } } }),
  ]);

  return {
    newUsers, totalUsers, newLikes, newShares, newSignups,
    watchCompletions, openAlerts, emailFailures, totalPublished, newWorks, pageViews,
    videoPending, videoFailed, videoStuck,
    subFailed, keyInvalid,
    newUnsubscribes, newBounces, newComplaints, newManualSuppressions,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.adminSettings.findUnique({
    where: { id: "singleton" },
    select: { adminAlertEmail: true, emailSendingEnabled: true },
  });

  if (!settings?.emailSendingEnabled) {
    return NextResponse.json({ skipped: "Email sending is disabled in admin settings" });
  }

  // Resolve admin recipients
  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
    select: { id: true, email: true },
  });

  const recipients: string[] = settings.adminAlertEmail
    ? [settings.adminAlertEmail]
    : adminUsers.map((a) => a.email);

  if (recipients.length === 0) {
    return NextResponse.json({ skipped: "No admin recipients configured" });
  }

  const since  = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stats  = await getStats(since);

  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "https://aimstudio.app";
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const html = buildEmailHtml({ dateStr, appUrl, stats });

  // Send email to all recipients
  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `Good Morning — AIM Studio Daily Report · ${dateStr}`,
        html,
        type: "ADMIN_ALERT",
        metadata: {
          reportDate: new Date().toISOString(),
          stats: { newUsers: stats.newUsers, newLikes: stats.newLikes },
        },
      }),
    ),
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  // Create in-app SYSTEM notification for every admin user
  const hasHealthIssues = stats.videoFailed + stats.videoStuck + stats.subFailed + stats.keyInvalid + stats.openAlerts > 0;
  const notifTitle = hasHealthIssues
    ? `Daily Report — ${stats.openAlerts + stats.videoFailed + stats.videoStuck} issue${stats.openAlerts + stats.videoFailed + stats.videoStuck === 1 ? "" : "s"} need attention`
    : `Daily Report — ${dateStr.split(",")[0]}`;
  const notifBody = `Page views: ${stats.pageViews} · New users: ${stats.newUsers} · Watch completions: ${stats.watchCompletions}`;

  if (adminUsers.length > 0) {
    await prisma.notification.createMany({
      data: adminUsers.map((u) => ({
        userId:    u.id,
        type:      "SYSTEM" as const,
        title:     notifTitle,
        body:      notifBody,
        href:      "/admin",
        read:      false,
      })),
    });
  }

  return NextResponse.json({ ok: true, sent, failed, recipients: recipients.length, notificationsCreated: adminUsers.length });
}

// ── Email HTML ────────────────────────────────────────────────────────────────

type Stats = Awaited<ReturnType<typeof getStats>>;

function stat(value: number, good = true): string {
  const colour = value > 0 && good ? "#e8c97e" : value > 0 && !good ? "#e05252" : "#6b7280";
  return `<span style="font-size:22px;font-weight:700;color:${colour};font-family:Georgia,serif;">${value}</span>`;
}

function row(label: string, value: number, good = true): string {
  return `
    <tr>
      <td style="padding:10px 16px;color:#9ca3af;font-size:13px;border-bottom:1px solid #1f1f1f;">${label}</td>
      <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #1f1f1f;">${stat(value, good)}</td>
    </tr>`;
}

function buildEmailHtml({ dateStr, appUrl, stats }: { dateStr: string; appUrl: string; stats: Stats }): string {
  const hasAlerts   = stats.openAlerts > 0;
  const hasFailures = stats.emailFailures > 0;
  const hasVideoIssues = stats.videoFailed > 0 || stats.videoStuck > 0;
  const hasSubIssues = stats.subFailed > 0;
  const hasKeyIssues = stats.keyInvalid > 0;

  const alertParts: string[] = [];
  if (hasAlerts)      alertParts.push(`⚠ ${stats.openAlerts} open security alert${stats.openAlerts !== 1 ? "s" : ""} — <a href="${appUrl}/admin/security" style="color:#e05252;">review</a>`);
  if (hasFailures)    alertParts.push(`${stats.emailFailures} email queue failure${stats.emailFailures !== 1 ? "s" : ""} — <a href="${appUrl}/admin/email" style="color:#e05252;">check queue</a>`);
  if (hasVideoIssues) alertParts.push(`${stats.videoFailed + stats.videoStuck} video job issue${stats.videoFailed + stats.videoStuck !== 1 ? "s" : ""} — <a href="${appUrl}/admin/works" style="color:#e05252;">view jobs</a>`);
  if (hasSubIssues)   alertParts.push(`${stats.subFailed} subtitle failure${stats.subFailed !== 1 ? "s" : ""} — <a href="${appUrl}/admin/works" style="color:#e05252;">manage</a>`);
  if (hasKeyIssues)   alertParts.push(`${stats.keyInvalid} translation key invalid — <a href="${appUrl}/admin/translation-keys" style="color:#e05252;">manage keys</a>`);

  const alertBanner = alertParts.length > 0
    ? `<tr>
        <td colspan="2" style="background:#2a1a1a;padding:12px 16px;color:#e05252;font-size:12px;font-weight:600;letter-spacing:.05em;border-radius:4px;margin-bottom:8px;line-height:1.8;">
          ${alertParts.join("<br />")}
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Good Morning — AIM Studio Daily Report</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:.15em;color:#6b7280;text-transform:uppercase;font-weight:600;">AIM Studio</p>
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;color:#f9fafb;letter-spacing:-.01em;">Good Morning ☀️</h1>
              <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${dateStr}</p>
            </td>
          </tr>

          <!-- Alert banner -->
          ${alertBanner ? `<tr><td><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">${alertBanner}</table></td></tr>` : ""}

          <!-- Stats card -->
          <tr>
            <td style="background:#111111;border-radius:8px;border:1px solid #1f1f1f;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Last 24 hours -->
                <tr>
                  <td colspan="2" style="padding:14px 16px 6px;font-size:10px;letter-spacing:.12em;color:#6b7280;text-transform:uppercase;font-weight:600;background:#0f0f0f;">
                    Last 24 Hours
                  </td>
                </tr>
                ${row("New Registrations", stats.newUsers)}
                ${row("Page Views", stats.pageViews)}
                ${row("New Likes", stats.newLikes)}
                ${row("Shares", stats.newShares)}
                ${row("Notify Me Signups", stats.newSignups)}
                ${row("Watch Completions", stats.watchCompletions)}
                ${row("New Works Added", stats.newWorks)}

                <!-- Platform -->
                <tr>
                  <td colspan="2" style="padding:18px 16px 6px;font-size:10px;letter-spacing:.12em;color:#6b7280;text-transform:uppercase;font-weight:600;background:#0f0f0f;">
                    Platform
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;color:#9ca3af;font-size:13px;border-bottom:1px solid #1f1f1f;">Total Published Works</td>
                  <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #1f1f1f;">${stat(stats.totalPublished)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;color:#9ca3af;font-size:13px;border-bottom:1px solid #1f1f1f;">Total Active Members</td>
                  <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #1f1f1f;">${stat(stats.totalUsers)}</td>
                </tr>

                <!-- System Health -->
                <tr>
                  <td colspan="2" style="padding:18px 16px 6px;font-size:10px;letter-spacing:.12em;color:#6b7280;text-transform:uppercase;font-weight:600;background:#0f0f0f;">
                    System Health
                  </td>
                </tr>
                ${row("Video Jobs Pending", stats.videoPending, false)}
                ${row("Video Jobs Failed", stats.videoFailed, false)}
                ${row("Video Jobs Stuck", stats.videoStuck, false)}
                ${row("Subtitle Jobs Failed", stats.subFailed, false)}
                ${row("Translation Keys Invalid", stats.keyInvalid, false)}

                <!-- Email Suppression -->
                <tr>
                  <td colspan="2" style="padding:18px 16px 6px;font-size:10px;letter-spacing:.12em;color:#6b7280;text-transform:uppercase;font-weight:600;background:#0f0f0f;">
                    Email Suppression (Last 24 Hours)
                  </td>
                </tr>
                ${row("New Unsubscribes", stats.newUnsubscribes, false)}
                ${row("New Bounces", stats.newBounces, false)}
                ${row("New Complaints", stats.newComplaints, false)}
                ${row("Manual Suppressions", stats.newManualSuppressions, false)}
                ${(stats.newUnsubscribes + stats.newBounces + stats.newComplaints + stats.newManualSuppressions) > 0 ? `
                <tr>
                  <td colspan="2" style="padding:8px 16px 12px;font-size:11px;color:#6b7280;border-bottom:1px solid #1f1f1f;">
                    Review suppressions in
                    <a href="${appUrl}/admin/email/suppressions" style="color:#e8c97e;text-decoration:none;">Admin → Email → Suppressions</a>.
                  </td>
                </tr>` : ""}

                <!-- Alerts -->
                <tr>
                  <td colspan="2" style="padding:18px 16px 6px;font-size:10px;letter-spacing:.12em;color:#6b7280;text-transform:uppercase;font-weight:600;background:#0f0f0f;">
                    Alerts
                  </td>
                </tr>
                ${row("Open Security Alerts", stats.openAlerts, false)}
                ${row("Email Queue Failures", stats.emailFailures, false)}

              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <a href="${appUrl}/admin"
                style="display:inline-block;padding:11px 28px;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:600;text-decoration:none;border-radius:4px;letter-spacing:.03em;">
                Open Admin Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 0 0;text-align:center;color:#374151;font-size:11px;line-height:1.6;">
              <p style="margin:0;">This report is sent daily at 08:00 UTC to AIM Studio admins.</p>
              <p style="margin:4px 0 0;">To change the recipient, update <strong>Admin Alert Email</strong> in
                <a href="${appUrl}/admin/settings" style="color:#6b7280;">Admin → Settings</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
