// Admin analytics dashboard — server-rendered, no client JS, no chart library.
// All queries run only under /admin (isolated from public bundle).
// CSS-only bar charts — no recharts/chart.js installed.
// Time range controlled via searchParams — pure link navigation, no state.

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";
import "./analytics.css";

export const metadata: Metadata = { title: "Admin — Analytics" };

type Props = {
  searchParams: Promise<{ range?: string }>;
};

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d",    label: "7 days" },
  { value: "30d",   label: "30 days" },
  { value: "all",   label: "All time" },
];

function getRangeStart(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: "Mobile", TABLET: "Tablet", DESKTOP: "Desktop",
  BOT: "Bot", UNKNOWN: "Unknown",
};

/** Width % for CSS bar chart — first item is always 100 %. */
function barPct(value: number, max: number): string {
  return max === 0 ? "0%" : `${Math.round((value / max) * 100)}%`;
}

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const { range = "30d" } = await searchParams;
  const since = getRangeStart(range);

  // ── Parallel aggregation queries ────────────────────────────────────
  const [
    totalPageViews,
    totalSessions,
    totalSignUps,
    totalWatchStarts,
    totalWatchCompletes,
    deviceBreakdown,
    countryBreakdown,
    topPagesRaw,
    topWorksRaw,
  ] = await Promise.all([

    // Overview counts
    prisma.analyticsEvent.count({
      where: since
        ? { type: "PAGE_VIEW", createdAt: { gte: since } }
        : { type: "PAGE_VIEW" },
    }),
    prisma.visitorSession.count({
      where: since ? { createdAt: { gte: since } } : undefined,
    }),
    prisma.analyticsEvent.count({
      where: since
        ? { type: "SIGN_UP", createdAt: { gte: since } }
        : { type: "SIGN_UP" },
    }),
    prisma.analyticsEvent.count({
      where: since
        ? { type: "WATCH_START", createdAt: { gte: since } }
        : { type: "WATCH_START" },
    }),
    prisma.analyticsEvent.count({
      where: since
        ? { type: "WATCH_COMPLETE", createdAt: { gte: since } }
        : { type: "WATCH_COMPLETE" },
    }),

    // Device breakdown (exclude bots)
    prisma.visitorSession.groupBy({
      by: ["deviceType"],
      where: since
        ? { isBot: false, createdAt: { gte: since } }
        : { isBot: false },
      _count: { deviceType: true },
      orderBy: { _count: { deviceType: "desc" } },
    }),

    // Country breakdown (top 8, no nulls)
    prisma.visitorSession.groupBy({
      by: ["country"],
      where: since
        ? { isBot: false, country: { not: null }, createdAt: { gte: since } }
        : { isBot: false, country: { not: null } },
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: 8,
    }),

    // Top pages by PAGE_VIEW count
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: since
        ? { type: "PAGE_VIEW", path: { not: null }, createdAt: { gte: since } }
        : { type: "PAGE_VIEW", path: { not: null } },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 10,
    }),

    // Top works by WORK_VIEW + WATCH_START events
    prisma.analyticsEvent.groupBy({
      by: ["workId"],
      where: since
        ? { type: { in: ["WORK_VIEW", "WATCH_START"] }, workId: { not: null }, createdAt: { gte: since } }
        : { type: { in: ["WORK_VIEW", "WATCH_START"] }, workId: { not: null } },
      _count: { workId: true },
      orderBy: { _count: { workId: "desc" } },
      take: 10,
    }),
  ]);

  // ── Resolve work titles for top works ───────────────────────────────
  const workIds = topWorksRaw
    .map((r) => r.workId)
    .filter((id): id is string => id !== null);

  const workDetails = workIds.length
    ? await prisma.work.findMany({
        where: { id: { in: workIds } },
        select: { id: true, title: true, type: true },
      })
    : [];

  const workMap = new Map(workDetails.map((w) => [w.id, w]));
  const topWorks = topWorksRaw.map((r) => ({
    workId: r.workId!,
    count:  r._count.workId,
    work:   workMap.get(r.workId!),
  }));

  // ── Derived metrics ─────────────────────────────────────────────────
  const completionRate =
    totalWatchStarts > 0
      ? Math.round((totalWatchCompletes / totalWatchStarts) * 100)
      : 0;

  const deviceMax  = deviceBreakdown[0]?._count.deviceType ?? 0;
  const countryMax = countryBreakdown[0]?._count.country   ?? 0;
  const pageMax    = topPagesRaw[0]?._count.path            ?? 0;
  const workMax    = topWorks[0]?.count                     ?? 0;

  const stats = [
    { label: "Page Views",   value: totalPageViews.toLocaleString(),       note: "recorded loads" },
    { label: "Sessions",     value: totalSessions.toLocaleString(),         note: "browsing windows" },
    { label: "Sign-ups",     value: totalSignUps.toLocaleString(),          note: "new accounts" },
    { label: "Watch Starts", value: totalWatchStarts.toLocaleString(),      note: "video plays" },
    { label: "Completion",   value: `${completionRate}%`,                   note: "videos finished" },
  ];

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Analytics</h1>
        <div className="arange">
          {RANGE_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={`?range=${opt.value}`}
              className={`arange-btn${range === opt.value ? " arange-btn--active" : ""}`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Overview stats ── */}
      <div className="astats">
        {stats.map((s) => (
          <div key={s.label} className="astat">
            <div className="astat-value">{s.value}</div>
            <div className="astat-label">{s.label}</div>
            <div className="astat-note">{s.note}</div>
          </div>
        ))}
      </div>

      {/* ── Breakdown row ── */}
      <div className="acols">

        {/* Devices */}
        <div className="asection">
          <h2 className="asection-title">Devices</h2>
          {deviceBreakdown.length === 0 ? (
            <p className="aempty">No session data yet.</p>
          ) : (
            <div className="achart">
              {deviceBreakdown.map((d) => (
                <div key={d.deviceType} className="abar-row">
                  <span className="abar-label">
                    {DEVICE_LABELS[d.deviceType] ?? d.deviceType}
                  </span>
                  <div className="abar-track">
                    <div
                      className="abar-fill"
                      style={{ width: barPct(d._count.deviceType, deviceMax) }}
                    />
                  </div>
                  <span className="abar-count">{d._count.deviceType}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Countries */}
        <div className="asection">
          <h2 className="asection-title">Countries</h2>
          {countryBreakdown.length === 0 ? (
            <p className="aempty">
              No geo data yet — country is populated from Vercel edge
              headers after deployment.
            </p>
          ) : (
            <div className="achart">
              {countryBreakdown.map((c) => (
                <div key={c.country} className="abar-row">
                  <span className="abar-label">{c.country ?? "Unknown"}</span>
                  <div className="abar-track">
                    <div
                      className="abar-fill"
                      style={{ width: barPct(c._count.country, countryMax) }}
                    />
                  </div>
                  <span className="abar-count">{c._count.country}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Top pages ── */}
      <div className="asection">
        <h2 className="asection-title">Top Pages</h2>
        {topPagesRaw.length === 0 ? (
          <p className="aempty">No page view data yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Page</th>
                  <th style={{ width: 80 }}>Views</th>
                  <th style={{ width: 160 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {topPagesRaw.map((p, i) => (
                  <tr key={p.path}>
                    <td className="a-muted a-num">{i + 1}</td>
                    <td className="a-primary">{p.path ?? "/"}</td>
                    <td className="a-muted">{p._count.path}</td>
                    <td>
                      <div className="abar-track">
                        <div
                          className="abar-fill"
                          style={{ width: barPct(p._count.path, pageMax) }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Top works ── */}
      <div className="asection">
        <h2 className="asection-title">Top Works</h2>
        {topWorks.length === 0 ? (
          <p className="aempty">No work view data yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>#</th>
                  <th>Work</th>
                  <th>Type</th>
                  <th style={{ width: 80 }}>Plays</th>
                  <th style={{ width: 160 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {topWorks.map((w, i) => (
                  <tr key={w.workId}>
                    <td className="a-muted a-num">{i + 1}</td>
                    <td className="a-primary">
                      {w.work?.title ?? (
                        <span className="a-muted">{w.workId}</span>
                      )}
                    </td>
                    <td>
                      {w.work?.type && (
                        <span className="type-label">
                          {w.work.type.replace(/_/g, " ")}
                        </span>
                      )}
                    </td>
                    <td className="a-muted">{w.count}</td>
                    <td>
                      <div className="abar-track">
                        <div
                          className="abar-fill"
                          style={{ width: barPct(w.count, workMax) }}
                        />
                      </div>
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
