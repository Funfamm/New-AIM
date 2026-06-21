import { prisma } from "@/lib/prisma";
import Link from "next/link";
import LogsTable, { type LogRow } from "./logs-table";

type StatusFilter = "ALL" | "SENT" | "FAILED" | "SUPPRESSED" | "QUEUED" | "SKIPPED";
const STATUS_OPTIONS: StatusFilter[] = ["ALL", "SENT", "FAILED", "SUPPRESSED", "QUEUED", "SKIPPED"];

interface Props {
  statusFilter: StatusFilter;
  typeFilter:   string;
}

export default async function TabLogs({ statusFilter, typeFilter }: Props) {
  const where = {
    ...(statusFilter !== "ALL" ? { status: statusFilter as any } : {}),
    ...(typeFilter              ? { type:   typeFilter   as any } : {}),
  };

  const [logs, counts, engagementCounts] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, to: true, subject: true, type: true,
        provider: true, status: true, error: true, createdAt: true,
        openedAt: true, clickedAt: true,
      },
    }),
    prisma.emailLog.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.emailLog.aggregate({
      _count: { openedAt: true, clickedAt: true },
      where:  { status: "SENT" },
    }),
  ]);

  const countMap: Record<string, number> = {};
  for (const row of counts) countMap[row.status] = row._count._all;
  const totalAll     = counts.reduce((sum, r) => sum + r._count._all, 0);
  const totalSent    = countMap["SENT"] ?? 0;
  const totalOpened  = engagementCounts._count.openedAt  ?? 0;
  const totalClicked = engagementCounts._count.clickedAt ?? 0;
  const openRate     = totalSent > 0 ? Math.round((totalOpened  / totalSent) * 100) : 0;
  const clickRate    = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  // Serialize Dates for client component
  const rows: LogRow[] = logs.map((l) => ({
    ...l,
    openedAt:  l.openedAt  ? l.openedAt.toISOString()  : null,
    clickedAt: l.clickedAt ? l.clickedAt.toISOString()  : null,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <>
      {/* ── Stats ── */}
      <section className="email-section">
        <div className="email-stats" style={{ marginBottom: "1.5rem" }}>
          <div className="email-stat">
            <span className="email-stat-val">{totalAll.toLocaleString()}</span>
            <span className="email-stat-label">Total</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--green">{(countMap["SENT"] ?? 0).toLocaleString()}</span>
            <span className="email-stat-label">Sent</span>
          </div>
          <div className="email-stat">
            <span className={`email-stat-val${(countMap["FAILED"] ?? 0) > 0 ? " email-stat-val--red" : ""}`}>
              {(countMap["FAILED"] ?? 0).toLocaleString()}
            </span>
            <span className="email-stat-label">Failed</span>
          </div>
          <div className="email-stat">
            <span className="email-stat-val email-stat-val--muted">{(countMap["SUPPRESSED"] ?? 0).toLocaleString()}</span>
            <span className="email-stat-label">Suppressed</span>
          </div>
          {(countMap["QUEUED"] ?? 0) > 0 && (
            <div className="email-stat">
              <span className="email-stat-val email-stat-val--amber">{countMap["QUEUED"]!.toLocaleString()}</span>
              <span className="email-stat-label">Queued</span>
            </div>
          )}
        </div>

        {/* Engagement analysis */}
        <div style={{ marginTop: "1.25rem", padding: "1rem 1.25rem", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 6 }}>
          <p style={{ margin: "0 0 0.85rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", fontFamily: "var(--font-body)" }}>
            Engagement — all-time (SENT emails only)
          </p>
          <div style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: "1.5rem", fontWeight: 700, color: "#4ade80", lineHeight: 1, fontFamily: "var(--font-body)" }}>{openRate}%</p>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#6b7280", fontFamily: "var(--font-body)" }}>
                Open rate&ensp;<span style={{ color: "#374151" }}>({totalOpened.toLocaleString()} / {totalSent.toLocaleString()})</span>
              </p>
            </div>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: "1.5rem", fontWeight: 700, color: "#e8c97e", lineHeight: 1, fontFamily: "var(--font-body)" }}>{clickRate}%</p>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#6b7280", fontFamily: "var(--font-body)" }}>
                Click-through rate&ensp;<span style={{ color: "#374151" }}>({totalClicked.toLocaleString()} / {totalSent.toLocaleString()})</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Filters ── */}
      <section className="email-section">
        <div className="email-filter-row">
          {STATUS_OPTIONS.map((s) => (
            <Link
              key={s}
              href={`/admin/email?tab=logs&status=${s}${typeFilter ? `&type=${typeFilter}` : ""}`}
              className={`email-filter-pill${statusFilter === s ? " email-filter-pill--active" : ""}`}
            >
              {s === "ALL" ? `All (${totalAll.toLocaleString()})` : `${s} (${(countMap[s] ?? 0).toLocaleString()})`}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Table with bulk select/delete + housekeeping ── */}
      <section className="email-section">
        <p className="email-hint">
          Showing {logs.length.toLocaleString()} most recent{statusFilter !== "ALL" ? ` ${statusFilter}` : ""} emails
          {logs.length === 200 ? " · limit 200" : ""}.
        </p>
        <LogsTable logs={rows} />
      </section>
    </>
  );
}
