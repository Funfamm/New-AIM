/**
 * GET /api/cron/error-digest  (Vercel Cron — daily)
 *
 * Emails admins a digest of the error monitor: open totals, new groups in the
 * last 24h, and regressions. Skips quietly when there's nothing to report.
 * Auth: Bearer CRON_SECRET. Schedule: "0 9 * * *".
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { premiumTransactionalEmail } from "@/lib/email-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Row = { id: string; level: string; message: string; count: number; route: string | null; lastRelease: string | null };

const SELECT = { id: true, level: true, message: true, count: true, route: true, lastRelease: true } as const;

function rowsHtml(appUrl: string, rows: Row[]): string {
  if (rows.length === 0) return `<p style="margin:0 0 14px;font-size:13px;color:#6b7280;">None.</p>`;
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 18px;width:100%;font-size:13px;">
    ${rows.map((r) => `<tr>
      <td style="padding:7px 0;border-bottom:1px solid #1f1f1f;color:#f3f4f6;">
        <a href="${appUrl}/admin/errors/${r.id}" style="color:#f3f4f6;text-decoration:none;">
          <strong style="color:#e8c97e;">${esc(r.level)}</strong> ${esc(r.message.slice(0, 120))}
        </a>
        <span style="color:#6b7280;"> · ×${r.count}${r.route ? ` · ${esc(r.route)}` : ""}${r.lastRelease ? ` · ${esc(r.lastRelease)}` : ""}</span>
      </td>
    </tr>`).join("")}
  </table>`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 86_400_000);

  let openTotal = 0, fatalOpen = 0, newGroups = 0;
  let topOpen: Row[] = [], newList: Row[] = [], regressions: Row[] = [];
  try {
    [openTotal, fatalOpen, newGroups, topOpen, newList, regressions] = await Promise.all([
      prisma.errorLog.count({ where: { status: { in: ["NEW", "ACKNOWLEDGED"] } } }),
      prisma.errorLog.count({ where: { status: { in: ["NEW", "ACKNOWLEDGED"] }, level: "FATAL" } }),
      prisma.errorLog.count({ where: { firstSeenAt: { gte: since } } }),
      prisma.errorLog.findMany({ where: { status: { in: ["NEW", "ACKNOWLEDGED"] } }, orderBy: { count: "desc" }, take: 8, select: SELECT }),
      prisma.errorLog.findMany({ where: { firstSeenAt: { gte: since } }, orderBy: { firstSeenAt: "desc" }, take: 8, select: SELECT }),
      prisma.errorLog.findMany({ where: { regressed: true, regressedAt: { gte: since } }, orderBy: { regressedAt: "desc" }, take: 8, select: SELECT }),
    ]);
  } catch {
    return NextResponse.json({ skipped: "error_logs table not ready" });
  }

  // Nothing worth an email.
  if (openTotal === 0 && newGroups === 0 && regressions.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "all clear" });
  }

  const settings = await prisma.adminSettings
    .findUnique({ where: { id: "singleton" }, select: { adminAlertEmail: true, emailSendingEnabled: true } })
    .catch(() => null);
  if (settings && settings.emailSendingEnabled === false) {
    return NextResponse.json({ skipped: "email sending disabled" });
  }
  const to = settings?.adminAlertEmail || process.env.ADMIN_ALERT_EMAIL || process.env.GRAPH_EMAIL_SENDER || "";
  if (!to) return NextResponse.json({ skipped: "no recipient configured" });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://impactaistudio.com").replace(/\/$/, "");
  const bodyHtml = `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;width:100%;font-size:13px;color:#d1d5db;">
      <tr><td style="padding:5px 0;color:#6b7280;width:160px;">Open issues</td><td style="padding:5px 0;color:#f3f4f6;font-weight:700;">${openTotal}${fatalOpen ? ` <span style="color:#ff7a76;">(${fatalOpen} fatal)</span>` : ""}</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280;">New in last 24h</td><td style="padding:5px 0;color:#f3f4f6;font-weight:700;">${newGroups}</td></tr>
      <tr><td style="padding:5px 0;color:#6b7280;">Regressions (24h)</td><td style="padding:5px 0;color:#f3f4f6;font-weight:700;">${regressions.length}</td></tr>
    </table>
    ${regressions.length ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#ff7a76;font-weight:700;">Regressions</p>${rowsHtml(appUrl, regressions)}` : ""}
    ${newList.length ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;font-weight:700;">New in last 24h</p>${rowsHtml(appUrl, newList)}` : ""}
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;font-weight:700;">Top open by volume</p>${rowsHtml(appUrl, topOpen)}
    <a href="${appUrl}/admin/errors" style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:13px;font-weight:700;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:3px;">Open Error Monitor</a>`;

  await sendEmail({
    to,
    subject: `Error digest — ${openTotal} open${fatalOpen ? `, ${fatalOpen} fatal` : ""}${regressions.length ? `, ${regressions.length} regressed` : ""}`,
    html: premiumTransactionalEmail({ label: "Error Digest", title: "Daily error digest", bodyHtml }),
    type: "ADMIN_ALERT",
  });

  return NextResponse.json({ ok: true, sent: true, openTotal, fatalOpen, newGroups, regressions: regressions.length });
}
