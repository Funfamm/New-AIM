// Visitor Intel tab — sessions, browser, OS, geo, returning vs new
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics — Visitors" };

function barPct(v: number, max: number) {
  return max === 0 ? "0%" : `${Math.round((v / max) * 100)}%`;
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: "📱 Mobile", TABLET: "📟 Tablet", DESKTOP: "🖥 Desktop", BOT: "🤖 Bot", UNKNOWN: "? Unknown",
};

export default async function VisitorsPage() {
  const now       = new Date();
  const weekStart = new Date(now.getTime() - 7 * 86400_000);

  const [
    totalSessions,
    sessionsWeek,
    guestSessions,
    loggedInSessions,
    deviceBreakdown,
    browserBreakdown,
    osBreakdown,
    countryBreakdown,
    recentSessions,
    returningCount,
  ] = await Promise.all([
    prisma.visitorSession.count({ where: { isBot: false } }),
    prisma.visitorSession.count({ where: { isBot: false, createdAt: { gte: weekStart } } }),
    prisma.visitorSession.count({ where: { isBot: false, userId: null } }),
    prisma.visitorSession.count({ where: { isBot: false, userId: { not: null } } }),

    prisma.visitorSession.groupBy({
      by: ["deviceType"],
      where: { isBot: false },
      _count: { deviceType: true },
      orderBy: { _count: { deviceType: "desc" } },
    }),
    prisma.visitorSession.groupBy({
      by: ["browser"],
      where: { isBot: false, browser: { not: null } },
      _count: { browser: true },
      orderBy: { _count: { browser: "desc" } },
      take: 8,
    }),
    prisma.visitorSession.groupBy({
      by: ["os"],
      where: { isBot: false, os: { not: null } },
      _count: { os: true },
      orderBy: { _count: { os: "desc" } },
      take: 8,
    }),
    prisma.visitorSession.groupBy({
      by: ["country"],
      where: { isBot: false, country: { not: null } },
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),

    // 20 most recent sessions
    prisma.visitorSession.findMany({
      where: { isBot: false },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
      select: {
        id: true, visitorId: true, userId: true,
        country: true, region: true, city: true,
        deviceType: true, browser: true, os: true,
        landingPage: true, referrer: true,
        startedAt: true, lastSeenAt: true,
      },
    }),

    // Returning visitors = visitorIds with more than 1 session
    prisma.visitorSession.groupBy({
      by: ["visitorId"],
      where: { isBot: false },
      _count: { visitorId: true },
      having: { visitorId: { _count: { gt: 1 } } },
    }).then((r) => r.length),
  ]);

  const deviceMax  = deviceBreakdown[0]?._count.deviceType  ?? 0;
  const browserMax = browserBreakdown[0]?._count.browser     ?? 0;
  const osMax      = osBreakdown[0]?._count.os               ?? 0;
  const countryMax = countryBreakdown[0]?._count.country     ?? 0;

  const loggedInPct = totalSessions > 0 ? Math.round((loggedInSessions / totalSessions) * 100) : 0;
  const returningPct = totalSessions > 0 ? Math.round((returningCount / totalSessions) * 100) : 0;

  return (
    <div>
      {/* ── Top stats ── */}
      <div className="astat-row">
        <div className="astat-cell">
          <div className="astat-cell-val">{totalSessions.toLocaleString()}</div>
          <div className="astat-cell-lbl">Total Sessions</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val astat-cell-val--accent">{sessionsWeek.toLocaleString()}</div>
          <div className="astat-cell-lbl">This Week</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{guestSessions.toLocaleString()}</div>
          <div className="astat-cell-lbl">Guest Sessions</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val astat-cell-val--green">{loggedInSessions.toLocaleString()}</div>
          <div className="astat-cell-lbl">Logged-in ({loggedInPct}%)</div>
        </div>
        <div className="astat-cell">
          <div className="astat-cell-val">{returningCount.toLocaleString()}</div>
          <div className="astat-cell-lbl">Returning ({returningPct}%)</div>
        </div>
      </div>

      {/* ── 3-col breakdown ── */}
      <div className="acols-3">

        <div className="asection" style={{ marginTop: 0 }}>
          <h2 className="asection-title">Devices</h2>
          <div className="achart">
            {deviceBreakdown.map((d) => (
              <div key={d.deviceType} className="abar-row">
                <span className="abar-label">{DEVICE_LABELS[d.deviceType] ?? d.deviceType}</span>
                <div className="abar-track"><div className="abar-fill" style={{ width: barPct(d._count.deviceType, deviceMax) }} /></div>
                <span className="abar-count">{d._count.deviceType}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="asection" style={{ marginTop: 0 }}>
          <h2 className="asection-title">Browsers</h2>
          {browserBreakdown.length === 0 ? <p className="aempty">No data yet.</p> : (
            <div className="achart">
              {browserBreakdown.map((b) => (
                <div key={b.browser} className="abar-row">
                  <span className="abar-label">{b.browser}</span>
                  <div className="abar-track"><div className="abar-fill" style={{ width: barPct(b._count.browser, browserMax) }} /></div>
                  <span className="abar-count">{b._count.browser}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="asection" style={{ marginTop: 0 }}>
          <h2 className="asection-title">Operating Systems</h2>
          {osBreakdown.length === 0 ? <p className="aempty">No data yet.</p> : (
            <div className="achart">
              {osBreakdown.map((o) => (
                <div key={o.os} className="abar-row">
                  <span className="abar-label">{o.os}</span>
                  <div className="abar-track"><div className="abar-fill" style={{ width: barPct(o._count.os, osMax) }} /></div>
                  <span className="abar-count">{o._count.os}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Countries ── */}
      <div className="asection">
        <h2 className="asection-title">Countries</h2>
        {countryBreakdown.length === 0 ? (
          <p className="aempty">No geo data — populated from Vercel edge headers after deployment.</p>
        ) : (
          <div className="achart">
            {countryBreakdown.map((c) => (
              <div key={c.country} className="abar-row">
                <span className="abar-label">{c.country ?? "Unknown"}</span>
                <div className="abar-track"><div className="abar-fill" style={{ width: barPct(c._count.country, countryMax) }} /></div>
                <span className="abar-count">{c._count.country}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent sessions ── */}
      <div className="asection">
        <div className="asection-hd">
          <h2 className="asection-title">Recent Sessions</h2>
          <span className="asection-count">20 most recent · humans only</span>
        </div>
        {recentSessions.length === 0 ? <p className="aempty">No session data yet.</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Device</th>
                  <th>Country</th>
                  <th>Browser / OS</th>
                  <th>Landing Page</th>
                  <th>Last Seen</th>
                  <th>Auth</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr key={s.id}>
                    <td className="a-muted" style={{ fontSize: "0.72rem", fontFamily: "monospace" }}>
                      {s.visitorId.slice(0, 8)}…
                    </td>
                    <td className="a-muted">{DEVICE_LABELS[s.deviceType] ?? s.deviceType}</td>
                    <td className="a-muted">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="a-muted" style={{ fontSize: "0.75rem" }}>{[s.browser, s.os].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="a-muted" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.landingPage ?? "—"}
                    </td>
                    <td className="a-muted" style={{ whiteSpace: "nowrap" }}>{timeAgo(s.lastSeenAt)}</td>
                    <td>
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 700, padding: "2px 5px", borderRadius: 3,
                        background: s.userId ? "rgba(74,222,128,0.1)" : "var(--color-brand-surface)",
                        color: s.userId ? "#4ade80" : "var(--color-brand-muted)",
                      }}>
                        {s.userId ? "User" : "Guest"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
