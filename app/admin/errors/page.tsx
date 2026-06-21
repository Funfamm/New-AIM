import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { resolveError, reopenError, deleteError, clearResolvedErrors } from "./error-actions";
import { CopyButton } from "./copy-button";
import { Sparkline } from "./sparkline";
import { formatReport, timeAgo } from "./format";
import { seriesBatch, HOUR_MS } from "@/lib/monitoring/buckets";
import Link from "next/link";
import { AlertTriangle, Check, RotateCcw, Trash2, Inbox, Search } from "lucide-react";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import "./errors-admin.css";

export const metadata: Metadata = { title: "Error Monitor — Admin" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SP = { filter?: string; level?: string; source?: string; q?: string; range?: string; sort?: string; page?: string };

const STATUS_FILTERS: Record<string, Prisma.ErrorLogWhereInput> = {
  open:     { status: { in: ["NEW", "ACKNOWLEDGED"] } },
  resolved: { status: "RESOLVED" },
  muted:    { status: { in: ["IGNORED", "MUTED"] } },
  all:      {},
};
const SOURCES = ["SERVER", "CLIENT", "API", "ACTION", "WORKER"] as const;
const RANGES: Record<string, number> = { "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 };
const SORTS: Record<string, Prisma.ErrorLogOrderByWithRelationInput> = {
  recent:    { lastSeenAt: "desc" },
  frequency: { count: "desc" },
  new:       { firstSeenAt: "desc" },
};

export default async function ErrorMonitorPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;

  const filter = sp.filter && sp.filter in STATUS_FILTERS ? sp.filter : "open";
  const level  = ["WARN", "ERROR", "FATAL"].includes(sp.level ?? "") ? sp.level : undefined;
  const source = SOURCES.includes(sp.source as (typeof SOURCES)[number]) ? sp.source : undefined;
  const range  = sp.range && sp.range in RANGES ? sp.range : undefined;
  const sort   = sp.sort && sp.sort in SORTS ? sp.sort : "recent";
  const q      = (sp.q ?? "").trim().slice(0, 120);
  const page   = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ErrorLogWhereInput = {
    ...STATUS_FILTERS[filter],
    ...(level ? { level: level as Prisma.ErrorLogWhereInput["level"] } : {}),
    ...(source ? { source: source as Prisma.ErrorLogWhereInput["source"] } : {}),
    ...(range ? { lastSeenAt: { gte: new Date(Date.now() - RANGES[range]) } } : {}),
    ...(q ? { OR: [{ message: { contains: q, mode: "insensitive" } }, { route: { contains: q, mode: "insensitive" } }] } : {}),
  };

  // Defensive: before the migration runs, the table won't exist.
  let rows: Awaited<ReturnType<typeof prisma.errorLog.findMany>> = [];
  let total = 0;
  let open = 0;
  let fatal = 0;
  let tableReady = true;
  try {
    [rows, total, open, fatal] = await Promise.all([
      prisma.errorLog.findMany({ where, orderBy: SORTS[sort], take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
      prisma.errorLog.count({ where }),
      prisma.errorLog.count({ where: { status: { in: ["NEW", "ACKNOWLEDGED"] } } }),
      prisma.errorLog.count({ where: { status: { in: ["NEW", "ACKNOWLEDGED"] }, level: "FATAL" } }),
    ]);
  } catch {
    tableReady = false;
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allReport = rows.map(formatReport).join(`\n\n${"─".repeat(60)}\n\n`);
  // One batched query for the 24h trend of every visible error group.
  const sparks = await seriesBatch(rows.map((r) => r.fingerprint), 24, HOUR_MS);

  const qs = (over: Partial<SP>) => {
    const base: Record<string, string | undefined> = { filter, level, source, q, range, sort, page: String(page), ...over };
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries(base)) if (v && v !== "recent" && !(k === "filter" && v === "open")) merged[k] = v;
    const qsStr = new URLSearchParams(merged).toString();
    return `/admin/errors${qsStr ? `?${qsStr}` : ""}`;
  };

  return (
    <main className="errmon">
      <header className="errmon-head">
        <div>
          <h1 className="errmon-title"><AlertTriangle size={20} /> Error Monitor</h1>
          <p className="errmon-sub">In-house error tracking — occurrences are grouped, counted, and trended.</p>
        </div>
        <div className="errmon-stats">
          <div className="errmon-stat"><span className="errmon-stat-num">{open}</span><span className="errmon-stat-lbl">Open</span></div>
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
          {/* Status + level tabs */}
          <div className="errmon-filters">
            <div className="errmon-tabs">
              {(["open", "resolved", "muted", "all"] as const).map((f) => (
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
            <div className="errmon-filter-actions">
              {rows.length > 0 && (
                <CopyButton text={allReport} label={`Copy all (${rows.length})`} title="Copy every error on this page" />
              )}
              {filter === "resolved" && total > 0 && (
                <form action={clearResolvedErrors} className="errmon-clear-form">
                  <button type="submit" className="errmon-clear-btn"><Trash2 size={13} /> Clear all resolved</button>
                </form>
              )}
            </div>
          </div>

          {/* Search + source/range/sort (server-rendered GET form) */}
          <form method="GET" action="/admin/errors" className="errmon-toolbar">
            <input type="hidden" name="filter" value={filter} />
            {level && <input type="hidden" name="level" value={level} />}
            <div className="errmon-search">
              <Search size={15} />
              <input type="search" name="q" defaultValue={q} placeholder="Search message or route…" className="errmon-search-input" />
            </div>
            <select name="source" defaultValue={source ?? ""} className="errmon-select">
              <option value="">All sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select name="range" defaultValue={range ?? ""} className="errmon-select">
              <option value="">All time</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <select name="sort" defaultValue={sort} className="errmon-select">
              <option value="recent">Most recent</option>
              <option value="frequency">Most frequent</option>
              <option value="new">Newest group</option>
            </select>
            <button type="submit" className="errmon-d-btn">Apply</button>
          </form>

          {rows.length === 0 ? (
            <div className="errmon-empty">
              <Check size={32} />
              <p>No errors match{q ? ` “${q}”` : ""}{level ? ` at ${level}` : ""}. {filter === "open" && !q && !level ? "All clear." : ""}</p>
            </div>
          ) : (
            <ul className="errmon-list">
              {rows.map((e) => (
                <li key={e.id} className={`errmon-item errmon-item--${e.level.toLowerCase()}`}>
                  <div className="errmon-item-main">
                    <div className="errmon-item-top">
                      <span className={`errmon-badge errmon-badge--${e.level.toLowerCase()}`}>{e.level}</span>
                      <span className="errmon-source">{e.source}</span>
                      {e.status !== "NEW" && <span className={`errmon-status errmon-status--${e.status.toLowerCase()}`}>{e.status}</span>}
                      {e.regressed && <span className="errmon-regressed" title="A resolved error has returned">REGRESSED</span>}
                      {e.count > 1 && <span className="errmon-count">×{e.count}</span>}
                      {e.lastRelease && <span className="errmon-tagchip" title="Last release this was seen on">{e.lastRelease}</span>}
                      <span className="errmon-time">{timeAgo(new Date(e.lastSeenAt))}</span>
                    </div>
                    <Link href={`/admin/errors/${e.id}`} className="errmon-message errmon-message-link">{e.message}</Link>
                    {e.route && <p className="errmon-route">{e.method ? `${e.method} ` : ""}{e.route}</p>}
                    <div className="errmon-meta">
                      <span><strong className="errmon-meta-num">{e.count}</strong> {e.count === 1 ? "occurrence" : "occurrences"}</span>
                      <span className="errmon-meta-dot">·</span>
                      <span>first seen {timeAgo(new Date(e.firstSeenAt))}</span>
                      <span className="errmon-meta-dot">·</span>
                      <span className="errmon-fp" title="Group fingerprint — same value means the same recurring issue">{e.fingerprint.slice(0, 8)}</span>
                      <Sparkline points={sparks.get(e.fingerprint) ?? []} width={120} height={24} className="errmon-row-spark" />
                    </div>
                    {(e.stack || e.metadata) && (
                      <details className="errmon-details">
                        <summary>Stack / context</summary>
                        {e.stack && <pre className="errmon-stack">{e.stack}</pre>}
                        {e.metadata != null && <pre className="errmon-stack">{JSON.stringify(e.metadata, null, 2)}</pre>}
                      </details>
                    )}
                  </div>
                  <div className="errmon-item-actions">
                    <CopyButton text={formatReport(e)} title="Copy this error" />
                    {e.status === "RESOLVED" ? (
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
