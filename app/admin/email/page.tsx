import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { addSuppression } from "@/lib/actions/email-admin";
import TestEmailButton from "./test-email-button";
import RemoveSuppressionButton from "./remove-suppression-button";
import { Mail, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import type { Metadata } from "next";
import "./email-admin.css";

export const metadata: Metadata = { title: "Email — Admin" };

function statusIcon(status: string) {
  if (status === "SENT")       return <CheckCircle  size={13} className="elog-sent"       />;
  if (status === "FAILED")     return <XCircle      size={13} className="elog-failed"     />;
  if (status === "SUPPRESSED") return <MinusCircle  size={13} className="elog-suppressed" />;
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

  const [logs, suppressions] = await Promise.all([
    prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.emailSuppression.findMany({
      where:   { active: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Config status — check env vars server-side, never expose values
  const graphConfigured = !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.GRAPH_EMAIL_SENDER
  );
  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  const fromEmail      = process.env.GRAPH_EMAIL_SENDER ?? "—";

  const sentCount    = logs.filter((l) => l.status === "SENT").length;
  const failedCount  = logs.filter((l) => l.status === "FAILED").length;
  const suppCount    = logs.filter((l) => l.status === "SUPPRESSED").length;

  return (
    <div className="email-page">
      <h1 className="admin-page-title">Email</h1>
      <p className="email-sub">Transactional email settings, log, and suppression list.</p>

      {/* ── Configuration ─────────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Configuration</h2>

        <div className="email-config-grid">

          {/* Transport */}
          <div className="email-config-card">
            <p className="email-config-label">Primary transport</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${graphConfigured ? "email-status-dot--ok" : "email-status-dot--err"}`} />
              <span className="email-config-val">Microsoft Graph</span>
              <span className="email-config-badge">{graphConfigured ? "Configured" : "Missing env vars"}</span>
            </div>
          </div>

          {/* SMTP */}
          <div className="email-config-card">
            <p className="email-config-label">SMTP fallback</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${smtpConfigured ? "email-status-dot--ok" : "email-status-dot--warn"}`} />
              <span className="email-config-val">SMTP</span>
              <span className="email-config-badge">{smtpConfigured ? "Configured" : "Not configured"}</span>
            </div>
          </div>

          {/* Sender identity */}
          <div className="email-config-card">
            <p className="email-config-label">Sender address</p>
            <p className="email-config-val">{fromEmail}</p>
          </div>

          {/* Reply-to */}
          <div className="email-config-card">
            <p className="email-config-label">Reply-to</p>
            <p className="email-config-val">{process.env.SMTP_FROM ?? fromEmail}</p>
          </div>

        </div>
      </section>

      {/* ── Test ──────────────────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Test Graph Email</h2>
        <p className="email-hint">Sends a test email to your admin account using Microsoft Graph. Result is logged below.</p>
        <TestEmailButton />
      </section>

      {/* ── Email types ───────────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Email types (V1)</h2>
        <div className="email-types-grid">
          {[
            { type: "PASSWORD_RESET", trigger: "Forgot password form",       wired: true  },
            { type: "WELCOME",        trigger: "After new account creation",  wired: true  },
            { type: "ADMIN_ALERT",    trigger: "Admin test button",           wired: true  },
            { type: "NOTIFICATION",   trigger: "User notifications",          wired: false },
            { type: "NEW_RELEASE",    trigger: "New work published",          wired: false },
            { type: "NEW_EPISODE",    trigger: "New episode added",           wired: false },
            { type: "ACCOUNT",        trigger: "Account changes",             wired: false },
            { type: "FUTURE_CAMPAIGN",trigger: "Campaign/newsletter (future)",wired: false },
          ].map((t) => (
            <div key={t.type} className="email-type-row">
              <span className={`email-type-dot ${t.wired ? "email-type-dot--on" : "email-type-dot--off"}`} />
              <span className="email-type-name">{t.type}</span>
              <span className="email-type-trigger">{t.trigger}</span>
              <span className={`email-type-badge ${t.wired ? "" : "email-type-badge--future"}`}>
                {t.wired ? "Active" : "Future"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Last 50 sends</h2>
        <div className="email-stats">
          <div className="email-stat"><span className="email-stat-val">{sentCount}</span><span className="email-stat-label">Sent</span></div>
          <div className="email-stat"><span className="email-stat-val email-stat-val--red">{failedCount}</span><span className="email-stat-label">Failed</span></div>
          <div className="email-stat"><span className="email-stat-val email-stat-val--muted">{suppCount}</span><span className="email-stat-label">Suppressed</span></div>
        </div>
      </section>

      {/* ── Email log ─────────────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Email log</h2>
        {logs.length === 0 ? (
          <p className="email-empty">No emails logged yet.</p>
        ) : (
          <div className="email-log-wrap">
            <table className="email-log-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Provider</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="elog-status-cell">{statusIcon(log.status)}<span>{log.status}</span></td>
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

      {/* ── Suppression list ──────────────────────────── */}
      <section className="email-section">
        <h2 className="email-section-title">Suppression list</h2>
        <p className="email-hint">Suppressed addresses will not receive any emails. Already-sent emails are not affected.</p>

        <form action={addSuppression} className="email-sup-form">
          <input type="email" name="email" required placeholder="email@example.com" className="email-sup-input" />
          <input type="text"  name="reason" placeholder="Reason (optional)" className="email-sup-input email-sup-input--reason" />
          <button type="submit" className="email-sup-btn">Add</button>
        </form>

        {suppressions.length === 0 ? (
          <p className="email-empty">No active suppressions.</p>
        ) : (
          <table className="email-sup-table">
            <thead>
              <tr><th>Email</th><th>Reason</th><th>Source</th><th>Added</th><th></th></tr>
            </thead>
            <tbody>
              {suppressions.map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td className="elog-provider">{s.reason ?? "—"}</td>
                  <td className="elog-provider">{s.source ?? "—"}</td>
                  <td className="elog-date">{fmtDate(s.createdAt)}</td>
                  <td><RemoveSuppressionButton email={s.email} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
