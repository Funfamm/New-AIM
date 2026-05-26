import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, CheckCircle, XCircle, MinusCircle, Clock } from "lucide-react";
import TestEmailButton from "./test-email-button";
import ProcessQueueButton from "./process-queue-button";
import type { Metadata } from "next";
import "./email-admin.css";

export const metadata: Metadata = { title: "Email — Admin" };

function statusIcon(status: string) {
  if (status === "SENT")       return <CheckCircle  size={13} className="elog-sent"       />;
  if (status === "FAILED")     return <XCircle      size={13} className="elog-failed"     />;
  if (status === "SUPPRESSED") return <MinusCircle  size={13} className="elog-suppressed" />;
  if (status === "QUEUED")     return <Clock        size={13} className="elog-queued"     />;
  return null;
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default async function AdminEmailPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") notFound();

  const [recentLogs, suppCount, queuedCount] = await Promise.all([
    prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.emailSuppression.count({ where: { active: true } }),
    prisma.emailQueue.count({ where: { status: "QUEUED" } }),
  ]);

  // Config status — env vars checked server-side, values never exposed
  const graphConfigured = !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.GRAPH_EMAIL_SENDER
  );
  const acsConfigured = !!(
    process.env.ACS_CONNECTION_STRING &&
    process.env.ACS_SENDER_ADDRESS
  );
  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  const fromEmail      = process.env.GRAPH_EMAIL_SENDER ?? "—";
  const acsSender      = process.env.ACS_SENDER_ADDRESS ?? "—";

  const sentCount   = recentLogs.filter((l) => l.status === "SENT").length;
  const failedCount = recentLogs.filter((l) => l.status === "FAILED").length;

  return (
    <div className="email-page">
      <h1 className="admin-page-title">Email</h1>
      <p className="email-sub">Provider configuration, recent activity, and quick actions.</p>

      {/* ── Configuration ─────────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Provider configuration</h2>

        <div className="email-config-grid">

          {/* Microsoft Graph — transactional */}
          <div className="email-config-card">
            <p className="email-config-label">Transactional (Graph)</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${graphConfigured ? "email-status-dot--ok" : "email-status-dot--err"}`} />
              <span className="email-config-val">Microsoft Graph</span>
              <span className="email-config-badge">{graphConfigured ? "Configured" : "Missing env vars"}</span>
            </div>
            {graphConfigured && (
              <p className="email-config-sub">{fromEmail}</p>
            )}
          </div>

          {/* ACS — bulk */}
          <div className="email-config-card">
            <p className="email-config-label">Bulk email (ACS)</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${acsConfigured ? "email-status-dot--ok" : "email-status-dot--warn"}`} />
              <span className="email-config-val">Azure Communication Services</span>
              <span className="email-config-badge">{acsConfigured ? "Configured" : "Not configured"}</span>
            </div>
            {acsConfigured && (
              <p className="email-config-sub">{acsSender}</p>
            )}
            {!acsConfigured && (
              <p className="email-config-sub">Set ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS</p>
            )}
          </div>

          {/* SMTP — fallback only */}
          <div className="email-config-card">
            <p className="email-config-label">SMTP fallback</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${smtpConfigured ? "email-status-dot--ok" : "email-status-dot--warn"}`} />
              <span className="email-config-val">SMTP</span>
              <span className="email-config-badge">{smtpConfigured ? "Configured" : "Not configured"}</span>
            </div>
          </div>

          {/* Queue */}
          <div className="email-config-card">
            <p className="email-config-label">Queued emails</p>
            <p className="email-config-val" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {queuedCount}
            </p>
            <p className="email-config-sub">awaiting dispatch</p>
          </div>

        </div>
      </section>

      {/* ── Routing rules ─────────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Provider routing</h2>
        <div className="email-routing-grid">
          <div className="email-routing-col">
            <p className="email-routing-head">Microsoft Graph → Transactional</p>
            <ul className="email-routing-list">
              <li>Password reset</li>
              <li>Welcome email</li>
              <li>Security alerts</li>
              <li>Account alerts</li>
              <li>Admin alerts</li>
            </ul>
          </div>
          <div className="email-routing-col">
            <p className="email-routing-head">ACS → Bulk / Marketing</p>
            <ul className="email-routing-list">
              <li>New release announcements</li>
              <li>New episode notifications</li>
              <li>Studio announcements</li>
              <li>Notify Me follow-up emails</li>
              <li>Future newsletters / campaigns</li>
            </ul>
          </div>
          <div className="email-routing-col">
            <p className="email-routing-head">SMTP → Emergency fallback</p>
            <ul className="email-routing-list">
              <li>Not used in normal operation</li>
              <li>Manual override only</li>
            </ul>
          </div>
        </div>
        {!acsConfigured && (
          <p className="email-hint" style={{ marginTop: "0.75rem", color: "#f59e0b" }}>
            ⚠ Bulk email provider (ACS) is not configured. Bulk sends are disabled until
            ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS are set.
          </p>
        )}
      </section>

      {/* ── Bulk email queue ──────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Bulk email queue (ACS)</h2>
        <p className="email-hint">
          Process queued bulk emails (new releases, announcements, Notify Me follow-ups).
          Runs up to 50 messages per batch. Respects suppression list and user preferences.
          Only processes if ACS is configured and bulk sending is enabled in Admin Settings.
        </p>
        {!acsConfigured && (
          <p className="email-hint" style={{ color: "#f59e0b" }}>
            ⚠ ACS not configured — set ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS to enable.
          </p>
        )}
        <ProcessQueueButton queuedCount={queuedCount} />
      </section>

      {/* ── Test transactional email ──────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Test transactional email</h2>
        <p className="email-hint">Sends a test email to your admin account via Microsoft Graph. Result is logged.</p>
        <TestEmailButton />
      </section>

      {/* ── Email types ───────────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Email types</h2>
        <div className="email-types-grid">
          {[
            { type: "PASSWORD_RESET",      trigger: "Forgot password form",              provider: "Graph", wired: true  },
            { type: "WELCOME",             trigger: "After account creation",            provider: "Graph", wired: true  },
            { type: "SECURITY_ALERT",      trigger: "Suspicious login / security event", provider: "Graph", wired: true  },
            { type: "ADMIN_ALERT",         trigger: "Admin test button",                 provider: "Graph", wired: true  },
            { type: "NEW_RELEASE",         trigger: "Admin broadcasts new work",         provider: "ACS",   wired: false },
            { type: "NEW_EPISODE",         trigger: "Admin broadcasts new episode",      provider: "ACS",   wired: false },
            { type: "ANNOUNCEMENT",        trigger: "Admin sends studio announcement",   provider: "ACS",   wired: false },
            { type: "NOTIFY_ME_FOLLOWUP",  trigger: "Admin triggers CTA follow-up",      provider: "ACS",   wired: false },
            { type: "ACCOUNT",             trigger: "Account changes",                   provider: "Graph", wired: false },
            { type: "FUTURE_CAMPAIGN",     trigger: "Newsletter / campaigns (future)",   provider: "ACS",   wired: false },
          ].map((t) => (
            <div key={t.type} className="email-type-row">
              <span className={`email-type-dot ${t.wired ? "email-type-dot--on" : "email-type-dot--off"}`} />
              <span className="email-type-name">{t.type}</span>
              <span className="email-type-trigger">{t.trigger}</span>
              <span className="email-type-provider">{t.provider}</span>
              <span className={`email-type-badge ${t.wired ? "" : "email-type-badge--future"}`}>
                {t.wired ? "Active" : "Planned"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent activity ───────────────────────────── */}
      <section className="email-section">
        <div className="email-section-head">
          <h2 className="email-section-title" style={{ margin: 0 }}>Recent sends</h2>
          <Link href="/admin/email/logs" className="email-view-all">View all logs →</Link>
        </div>
        <div className="email-stats">
          <div className="email-stat">
            <span className="email-stat-val">{sentCount}</span>
            <span className="email-stat-label">Sent (last 8)</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--red">{failedCount}</span>
            <span className="email-stat-label">Failed (last 8)</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--muted">{suppCount}</span>
            <span className="email-stat-label">Suppressed (total)</span>
          </div>
        </div>
        {recentLogs.length === 0 ? (
          <p className="email-empty">No emails sent yet.</p>
        ) : (
          <div className="email-log-wrap">
            <table className="email-log-table">
              <thead>
                <tr>
                  <th>Status</th><th>To</th><th>Subject</th>
                  <th>Type</th><th>Provider</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="elog-status-cell">
                        {statusIcon(log.status)}
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="elog-to">{log.to}</td>
                    <td className="elog-subject">{log.subject}</td>
                    <td><span className="elog-badge">{log.type}</span></td>
                    <td className="elog-provider">{log.provider}</td>
                    <td className="elog-date">{fmtDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Suppression summary ───────────────────────── */}
      <section className="email-section">
        <div className="email-section-head">
          <h2 className="email-section-title" style={{ margin: 0 }}>Suppression list</h2>
          <Link href="/admin/email/suppressions" className="email-view-all">Manage suppressions →</Link>
        </div>
        <p className="email-hint">
          {suppCount === 0
            ? "No active suppressions."
            : `${suppCount} address${suppCount === 1 ? "" : "es"} are suppressed and will not receive emails.`}
        </p>
      </section>

      {/* ── Email templates ───────────────────────────── */}
      <section className="email-section">
        <div className="email-section-head">
          <h2 className="email-section-title" style={{ margin: 0 }}>Email templates</h2>
          <Link href="/admin/email/templates" className="email-view-all">Manage templates →</Link>
        </div>
        <p className="email-hint">
          Create and edit reusable HTML email templates with variable placeholders.
          System templates (Password Reset, Welcome, Security Alert) are protected.
        </p>
      </section>

    </div>
  );
}
