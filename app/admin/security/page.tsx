// Admin Security — event log + alert management
// Server component. Paginated event log. Client AlertActions for resolve/dismiss.

import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertActions } from "./alert-actions";
import "./security-page.css";

export const metadata: Metadata = { title: "Admin — Security" };

const EV_PAGE_SIZE = 50;

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const evPage      = Math.max(1, parseInt(sp.page ?? "1", 10));
  const alertFilter = sp.alerts ?? "open"; // "open" | "all"

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    openAlertsCount,
    highEventsCount,
    blockedLoginsCount,
    totalEventsCount,
    alerts,
    events,
  ] = await Promise.all([
    prisma.securityAlert.count({ where: { status: "OPEN" } }),
    prisma.securityEvent.count({
      where: { severity: { in: ["HIGH", "CRITICAL"] }, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.securityEvent.count({
      where: { type: "LOGIN_BLOCKED", createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.securityEvent.count(),
    prisma.securityAlert.findMany({
      where: alertFilter === "all" ? {} : { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.securityEvent.findMany({
      orderBy: { createdAt: "desc" },
      skip: (evPage - 1) * EV_PAGE_SIZE,
      take: EV_PAGE_SIZE,
      select: {
        id:        true,
        type:      true,
        severity:  true,
        email:     true,
        country:   true,
        provider:  true,
        createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.ceil(totalEventsCount / EV_PAGE_SIZE);
  const pagingAlerts = sp.alerts ? `&alerts=${sp.alerts}` : "";

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Security</h1>
      </div>

      {/* ── Stats ── */}
      <div className="ustat-row">
        <div className="ustat-cell">
          <div className={`ustat-val${openAlertsCount > 0 ? " ustat-val--warn" : ""}`}>
            {openAlertsCount}
          </div>
          <div className="ustat-lbl">Open Alerts</div>
        </div>
        <div className="ustat-cell">
          <div className={`ustat-val${highEventsCount > 0 ? " ustat-val--warn" : ""}`}>
            {highEventsCount}
          </div>
          <div className="ustat-lbl">High+ Events (7d)</div>
        </div>
        <div className="ustat-cell">
          <div className={`ustat-val${blockedLoginsCount > 0 ? " ustat-val--warn" : ""}`}>
            {blockedLoginsCount}
          </div>
          <div className="ustat-lbl">Blocked Logins (7d)</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{totalEventsCount.toLocaleString()}</div>
          <div className="ustat-lbl">Total Events</div>
        </div>
      </div>

      {/* ── Alerts ── */}
      <div className="sec-section">
        <div className="sec-section-hd">
          <h2 className="sec-section-title">Security Alerts</h2>
          <div className="sec-tabs">
            <Link
              href="/admin/security"
              className={`sec-tab${!sp.alerts || sp.alerts === "open" ? " sec-tab--active" : ""}`}
            >
              Open{openAlertsCount > 0 ? ` (${openAlertsCount})` : ""}
            </Link>
            <Link
              href="/admin/security?alerts=all"
              className={`sec-tab${sp.alerts === "all" ? " sec-tab--active" : ""}`}
            >
              All
            </Link>
          </div>
        </div>

        {alerts.length === 0 ? (
          <p className="sec-empty">
            {alertFilter === "open" ? "No open alerts — all clear." : "No alerts yet."}
          </p>
        ) : (
          <div className="sec-alerts-list">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={[
                  "sec-alert-card",
                  `sec-alert-card--${a.severity.toLowerCase()}`,
                  a.status !== "OPEN" ? "sec-alert-card--done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="sec-alert-top">
                  <span className={`sec-sev sec-sev--${a.severity.toLowerCase()}`}>
                    {a.severity}
                  </span>
                  <span className="sec-alert-title">{a.title}</span>
                  {a.status !== "OPEN" && (
                    <span className="sec-alert-status-tag">{a.status}</span>
                  )}
                  <span className="sec-alert-ts">
                    {new Date(a.createdAt).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="sec-alert-msg">{a.message}</p>
                {a.status === "OPEN" && <AlertActions alertId={a.id} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Event Log ── */}
      <div className="sec-section">
        <div className="sec-section-hd">
          <h2 className="sec-section-title">Event Log</h2>
          <span className="sec-count">{totalEventsCount.toLocaleString()} total</span>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Email / Actor</th>
                <th>Country</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td className="sec-ev-time">
                    {new Date(ev.createdAt).toLocaleString("en-GB", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="sec-ev-type">{ev.type.replace(/_/g, " ")}</td>
                  <td>
                    <span className={`sec-sev sec-sev--${ev.severity.toLowerCase()}`}>
                      {ev.severity}
                    </span>
                  </td>
                  <td className="sec-ev-email">{ev.email ?? "—"}</td>
                  <td className="sec-ev-meta">{ev.country ?? "—"}</td>
                  <td className="sec-ev-meta">{ev.provider ?? "—"}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No security events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="upagination">
            {evPage > 1 ? (
              <Link
                href={`/admin/security?page=${evPage - 1}${pagingAlerts}`}
                className="upag-btn"
              >
                ← Prev
              </Link>
            ) : (
              <span className="upag-btn upag-btn--disabled">← Prev</span>
            )}
            <span className="upag-info">Page {evPage} of {totalPages}</span>
            {evPage < totalPages ? (
              <Link
                href={`/admin/security?page=${evPage + 1}${pagingAlerts}`}
                className="upag-btn"
              >
                Next →
              </Link>
            ) : (
              <span className="upag-btn upag-btn--disabled">Next →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
