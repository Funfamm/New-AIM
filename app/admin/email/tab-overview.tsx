import type React from "react";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CheckCircle, XCircle, MinusCircle, Clock } from "lucide-react";

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

export default async function TabOverview() {
  const [recentLogs, suppCount, queuedCount, bulkSettings, engagement] = await Promise.all([
    prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.emailSuppression.count({ where: { active: true } }),
    prisma.emailQueue.count({ where: { status: "QUEUED" } }),
    prisma.adminSettings.findUnique({
      where:  { id: "singleton" },
      select: { primaryBulkProvider: true },
    }),
    prisma.emailLog.aggregate({
      _count: { _all: true, openedAt: true, clickedAt: true },
      where:  { status: "SENT" },
    }),
  ]);

  const graphConfigured = !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.GRAPH_EMAIL_SENDER
  );
  const acsConfigured  = !!(process.env.ACS_CONNECTION_STRING && process.env.ACS_SENDER_ADDRESS);
  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
  const fromEmail = process.env.GRAPH_EMAIL_SENDER ?? "—";
  const acsSender = process.env.ACS_SENDER_ADDRESS ?? "—";

  const activeBulkProvider = (bulkSettings?.primaryBulkProvider ?? "acs").toUpperCase();
  const bulkProviderLabel  =
    activeBulkProvider === "GRAPH" ? "Graph" :
    activeBulkProvider === "ACS"   ? "ACS"   :
    activeBulkProvider === "SMTP"  ? "SMTP"  : activeBulkProvider;
  const bulkProviderOk =
    activeBulkProvider === "GRAPH" ? graphConfigured :
    activeBulkProvider === "ACS"   ? acsConfigured   : false;

  const sentCount    = recentLogs.filter((l) => l.status === "SENT").length;
  const failedCount  = recentLogs.filter((l) => l.status === "FAILED").length;
  const totalSent    = engagement._count._all   ?? 0;
  const totalOpened  = engagement._count.openedAt  ?? 0;
  const totalClicked = engagement._count.clickedAt ?? 0;
  const openRate  = totalSent > 0 ? Math.round((totalOpened  / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  return (
    <>
      {/* ── Provider config ── */}
      <section className="email-section">
        <h2 className="email-section-title">Provider configuration</h2>
        <div className="email-config-grid">
          <div className="email-config-card">
            <p className="email-config-label">Transactional</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${graphConfigured ? "email-status-dot--ok" : "email-status-dot--err"}`} />
              <span className="email-config-val">Microsoft Graph</span>
              <span className="email-config-badge">{graphConfigured ? "Configured" : "Missing env vars"}</span>
            </div>
            <p className="email-config-sub">{graphConfigured ? fromEmail : "Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, GRAPH_EMAIL_SENDER"}</p>
          </div>

          <div className="email-config-card">
            <p className="email-config-label">Bulk (ACS)</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${acsConfigured ? "email-status-dot--ok" : "email-status-dot--warn"}`} />
              <span className="email-config-val">Azure Communication Services</span>
              <span className="email-config-badge">{acsConfigured ? "Configured" : "Not configured"}</span>
            </div>
            <p className="email-config-sub">{acsConfigured ? acsSender : "Set ACS_CONNECTION_STRING and ACS_SENDER_ADDRESS"}</p>
          </div>

          <div className="email-config-card">
            <p className="email-config-label">SMTP fallback</p>
            <div className="email-config-row">
              <span className={`email-status-dot ${smtpConfigured ? "email-status-dot--ok" : "email-status-dot--warn"}`} />
              <span className="email-config-val">SMTP</span>
              <span className="email-config-badge">{smtpConfigured ? "Configured" : "Not configured"}</span>
            </div>
            <p className="email-config-sub">Not implemented — select Graph or ACS for bulk</p>
          </div>

          <div className="email-config-card">
            <p className="email-config-label">Queue</p>
            <p className="email-config-val" style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.04em", color: queuedCount > 0 ? "#f59e0b" : "var(--color-brand-white)" }}>{queuedCount}</p>
            <p className="email-config-sub">awaiting dispatch</p>
          </div>
        </div>
      </section>

      {/* ── Provider routing ── */}
      <section className="email-section">
        <h2 className="email-section-title">Provider routing</h2>
        <div className="email-routing-grid">
          <div className="email-routing-col">
            <p className="email-routing-head">Graph — Transactional</p>
            <ul className="email-routing-list">
              <li>Password reset</li>
              <li>Welcome email</li>
              <li>Security alerts</li>
              <li>Account notifications</li>
              <li>Admin alerts</li>
            </ul>
          </div>
          <div className="email-routing-col">
            <p className="email-routing-head">{bulkProviderLabel} — Bulk</p>
            <ul className="email-routing-list">
              <li>New release announcements</li>
              <li>New episode notifications</li>
              <li>Studio announcements</li>
              <li>Notify Me notices</li>
            </ul>
          </div>
          <div className="email-routing-col">
            <p className="email-routing-head">SMTP — Emergency fallback</p>
            <ul className="email-routing-list">
              <li>Not implemented</li>
              <li>Select Graph or ACS</li>
            </ul>
          </div>
        </div>
        {!bulkProviderOk && (
          <p className="email-hint" style={{ marginTop: "0.75rem", color: "#f59e0b" }}>
            ⚠ Active bulk provider ({activeBulkProvider}) is not configured. Bulk sends will fail until
            the provider is configured or switched in the Settings tab.
          </p>
        )}
      </section>

      {/* ── Email types ── */}
      <section className="email-section">
        <h2 className="email-section-title">Email types</h2>
        <div className="email-types-grid">
          {([
            { type: "PASSWORD_RESET",     trigger: "Forgot password form",             provider: "Graph"            },
            { type: "WELCOME",            trigger: "After account creation",           provider: "Graph"            },
            { type: "SECURITY_ALERT",     trigger: "Suspicious login / security event",provider: "Graph"            },
            { type: "ACCOUNT",            trigger: "Account suspend / restore",        provider: "Graph"            },
            { type: "ADMIN_ALERT",        trigger: "Admin test button",                provider: "Graph"            },
            { type: "NEW_RELEASE",        trigger: "Outreach / Work edit page",        provider: bulkProviderLabel  },
            { type: "NEW_EPISODE",        trigger: "Outreach / Episode edit page",     provider: bulkProviderLabel  },
            { type: "ANNOUNCEMENT",       trigger: "Outreach compose",                 provider: bulkProviderLabel  },
            { type: "NOTIFY_ME_FOLLOWUP", trigger: "Notify Me CTA — Send Notice",      provider: bulkProviderLabel  },
          ] as const).map((t) => (
            <div key={t.type} className="email-type-row">
              <span className="email-type-dot email-type-dot--on" />
              <span className="email-type-name">{t.type}</span>
              <span className="email-type-trigger">{t.trigger}</span>
              <span className="email-type-provider">{t.provider}</span>
              <span className="email-type-badge">Active</span>
            </div>
          ))}
        </div>

        <p className="email-hint" style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>Not yet available</p>
        <div className="email-types-grid">
          <div className="email-type-row">
            <span className="email-type-dot email-type-dot--off" />
            <span className="email-type-name">FUTURE_CAMPAIGN</span>
            <span className="email-type-trigger">Custom studio broadcast — not yet built</span>
            <span className="email-type-provider">—</span>
            <span className="email-type-badge email-type-badge--future">Future</span>
          </div>
        </div>
      </section>

      {/* ── Engagement ── */}
      <section className="email-section">
        <h2 className="email-section-title">Engagement (all-time)</h2>
        <div className="email-stats" style={{ marginBottom: 0 }}>
          <div className="email-stat" style={{ "--estat-glow": "rgba(74,222,128,0.12)" } as React.CSSProperties}>
            <span className="email-stat-val email-stat-val--green">{openRate}%</span>
            <span className="email-stat-label">Open rate</span>
          </div>
          <div className="email-stat" style={{ "--estat-glow": "rgba(226,184,101,0.12)" } as React.CSSProperties}>
            <span className="email-stat-val" style={{ color: "#e8c97e" }}>{clickRate}%</span>
            <span className="email-stat-label">Click-through</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val">{totalSent.toLocaleString()}</span>
            <span className="email-stat-label">Emails tracked</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--muted">{totalOpened.toLocaleString()}</span>
            <span className="email-stat-label">Opened</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--muted">{totalClicked.toLocaleString()}</span>
            <span className="email-stat-label">CTA clicked</span>
          </div>
        </div>
        <p className="email-hint" style={{ marginTop: "0.75rem" }}>
          Open rates undercount Apple Mail / Outlook users (privacy protection). Click-through is the reliable signal.
          <Link href="/admin/email?tab=logs" className="email-view-all" style={{ marginLeft: "0.5rem" }}>View full log →</Link>
        </p>
      </section>

      {/* ── Recent sends ── */}
      <section className="email-section">
        <div className="email-section-head">
          <h2 className="email-section-title" style={{ margin: 0 }}>Recent sends</h2>
          <Link href="/admin/email?tab=logs" className="email-view-all">View all logs →</Link>
        </div>
        <div className="email-stats" style={{ marginBottom: "1.25rem" }}>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--green">{sentCount}</span>
            <span className="email-stat-label">Sent (last 8)</span>
          </div>
          <div className="email-stat">
            <span className={`email-stat-val${failedCount > 0 ? " email-stat-val--red" : ""}`}>{failedCount}</span>
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
            <div className="email-log-scroll">
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
                      <td className="elog-subject" title={log.subject}>{log.subject}</td>
                      <td><span className="elog-badge">{log.type}</span></td>
                      <td className="elog-provider">{log.provider}</td>
                      <td className="elog-date">{fmtDate(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
