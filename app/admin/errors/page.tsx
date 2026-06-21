import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { resolveError, reopenError, deleteError, clearResolvedErrors } from "./error-actions";
import Link from "next/link";
import { AlertTriangle, Check, RotateCcw, Trash2, Inbox } from "lucide-react";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import "./errors-admin.css";

export const metadata: Metadata = { title: "Error Monitor — Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SP = { filter?: string; level?: string; page?: string };

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24); if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ErrorMonitorPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;

  const filter = sp.filter === "resolved" ? "resolved" : sp.filter === "all" ? "all" : "unresolved";
  const level  = ["WARN", "ERROR", "FATAL"].includes(sp.level ?? "") ? sp.level : undefined;
  const page   = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ErrorLogWhereInput = {
    ...(filter === "resolved" ? { resolved: true } : filter === "unresolved" ? { resolved: false } : {}),
    ...(level ? { level: level as Prisma.ErrorLogWhereInput["level"] } : {}),
  };

  // Defensive: before the migration runs, the table won't exist.
  let rows: Awaited<ReturnType<typeof prisma.errorLog.findMany>> = [];
  let total = 0;
  let unresolved = 0;
  let fatal = 0;
  let tableReady = true;
  try {
    [rows, total, unresolved, fatal] = await Promise.all([
      prisma.errorLog.findMany({ where, orderBy: { lastSeenAt: "desc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
      prisma.errorLog.count({ where }),
      prisma.errorLog.count({ where: { resolved: false } }),
      prisma.errorLog.count({ where: { resolved: false, level: "FATAL" } }),
    ]);
  } catch {
    tableReady = false;
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (over: Partial<SP>) => {
    const base: Record<string, string | undefined> = { filter, level, page: String(page), ...over };
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries(base)) if (v) merged[k] = v;
    return `/admin/errors?${new URLSearchParams(merged).toString()}`;
  };

  return (
    <main className="errmon">
      <header className="errmon-head">
        <div>
          <h1 className="errmon-title"><AlertTriangle size={20} /> Error Monitor</h1>
          <p className="errmon-sub">In-house error tracking — occurrences are grouped and counted.</p>
        </div>
        <div className="errmon-stats">
          <div className="errmon-stat"><span className="errmon-stat-num">{unresolved}</span><span className="errmon-stat-lbl">Unresolved</span></div>
          <div className={`errmon-stat${fatal > 0 ? " errmon-stat--alert" : ""}`}><span className="errmon-stat-num">{fatal}</span><span className="errmon-stat-lbl">Fatal</span></div>
        </div>
      </header>

      {!tableReady ? (
        <div className="errmon-empty">
          <Inbox size={32} />
          <p><strong>Monitoring not initialized.</strong></p>
          <p>Run the <code>error_logs</code> migration (<code>npx prisma migrate deploy</code>) to enable error tracking.</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="errmon-filters">
            <div className="errmon-tabs">
              {(["unresolved", "resolved", "all"] as const).map((f) => (
                <Link key={f} href={qs({ filter: f, page: "1" })} className={`errmon-tab${filter === f ? " errmon-tab--on" : ""}`}>
                  {f[0].toUpperCase() + f.slice(1)}
                </Link>
              ))}
            </div>
            <div className="errmon-tabs">
              <Link href={qs({ level: "", page: "1" })} className={`errmon-tab${!level ? " errmon-tab--on" : ""}`}>All levels</Link>
              {(["WARN", "ERROR", "FATAL"] as const).map((l) => (
                <Link key={l} href={qs({ level: l, page: "1" })} className={`errmon-tab errmon-tab--${l.toLowerCase()}${level === l ? " errmon-tab--on" : ""}`}>{l}</Link>
              ))}
            </div>
            {filter === "resolved" && total > 0 && (
              <form action={clearResolvedErrors} className="errmon-clear-form">
                <button type="submit" className="errmon-clear-btn"><Trash2 size={13} /> Clear all resolved</button>
              </form>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="errmon-empty">
              <Check size={32} />
              <p>No {filter === "all" ? "" : filter} errors{level ? ` at ${level}` : ""}. {filter === "unresolved" ? "All clear." : ""}</p>
            </div>
          ) : (
            <ul className="errmon-list">
              {rows.map((e) => (
                <li key={e.id} className={`errmon-item errmon-item--${e.level.toLowerCase()}`}>
                  <div className="errmon-item-main">
                    <div className="errmon-item-top">
                      <span className={`errmon-badge errmon-badge--${e.level.toLowerCase()}`}>{e.level}</span>
                      <span className="errmon-source">{e.source}</span>
                      {e.count > 1 && <span className="errmon-count">×{e.count}</span>}
                      {e.resolved && <span className="errmon-resolved-tag">resolved</span>}
                      <span className="errmon-time">{timeAgo(new Date(e.lastSeenAt))}</span>
                    </div>
                    <p className="errmon-message">{e.message}</p>
                    {e.route && <p className="errmon-route">{e.method ? `${e.method} ` : ""}{e.route}</p>}
                    {(e.stack || e.metadata) && (
                      <details className="errmon-details">
                        <summary>Stack / context</summary>
                        {e.stack && <pre className="errmon-stack">{e.stack}</pre>}
                        {e.metadata != null && <pre className="errmon-stack">{JSON.stringify(e.metadata, null, 2)}</pre>}
                      </details>
                    )}
                  </div>
                  <div className="errmon-item-actions">
                    {e.resolved ? (
                      <form action={reopenError}><input type="hidden" name="id" value={e.id} />
                        <button className="errmon-act" title="Reopen"><RotateCcw size={14} /></button>
                      </form>
                    ) : (
                      <form action={resolveError}><input type="hidden" name="id" value={e.id} />
                        <button className="errmon-act errmon-act--resolve" title="Mark resolved"><Check size={14} /></button>
                      </form>
                    )}
                    <form action={deleteError}><input type="hidden" name="id" value={e.id} />
                      <button className="errmon-act errmon-act--delete" title="Delete"><Trash2 size={14} /></button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="errmon-pager">
              {page > 1 && <Link href={qs({ page: String(page - 1) })} className="errmon-page-btn">← Prev</Link>}
              <span className="errmon-page-info">Page {page} of {pageCount}</span>
              {page < pageCount && <Link href={qs({ page: String(page + 1) })} className="errmon-page-btn">Next →</Link>}
            </div>
          )}
        </>
      )}
    </main>
  );
}
