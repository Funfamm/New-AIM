import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import Link from "next/link";
import type { Metadata } from "next";
import "./subscribers.css";

export const metadata: Metadata = { title: "Admin — Subscribers" };

const PAGE_SIZE = 50;

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function buildWhere(q: string, status: string) {
  const where: Record<string, unknown> = {};

  if (q.trim()) {
    where.OR = [
      { email:       { contains: q.trim(), mode: "insensitive" } },
      { name:        { contains: q.trim(), mode: "insensitive" } },
      { country:     { contains: q.trim(), mode: "insensitive" } },
      { countryCode: { contains: q.trim(), mode: "insensitive" } },
      { source:      { contains: q.trim(), mode: "insensitive" } },
    ];
  }

  if (status === "active")     { where.active = true;  where.suppressedAt = null; }
  if (status === "inactive")   { where.active = false; }
  if (status === "suppressed") { where.suppressedAt = { not: null }; }
  if (status === "converted")  { where.convertedAt = { not: null }; }
  if (status === "subscriber") { where.convertedAt = null; where.active = true; }

  return where;
}

function orderBy(sort: string) {
  if (sort === "oldest")   return { subscribedAt: "asc"  as const };
  if (sort === "fails")    return { failedSendCount: "desc" as const };
  if (sort === "country")  return { countryCode: "asc" as const };
  if (sort === "email")    return { email: "asc" as const };
  return { subscribedAt: "desc" as const };
}

function pageUrl(p: number, q: string, status: string, sort: string) {
  const sp = new URLSearchParams();
  if (q)                  sp.set("q",      q);
  if (status)             sp.set("status", status);
  if (sort !== "newest")  sp.set("sort",   sort);
  if (p > 1)              sp.set("page",   String(p));
  const qs = sp.toString();
  return `/admin/subscribers${qs ? `?${qs}` : ""}`;
}

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireAdmin();

  const sp     = await searchParams;
  const q      = sp.q      ?? "";
  const status = sp.status ?? "";
  const sort   = sp.sort   ?? "newest";
  const page   = Math.max(1, parseInt(sp.page ?? "1", 10));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const where = buildWhere(q, status);
  const isFiltered = !!(q || status);

  const [
    total,
    active,
    inactive,
    converted,
    suppressed,
    newThisMonth,
    failedSendsAgg,
    filteredTotal,
    subscribers,
  ] = await Promise.all([
    prisma.subscriber.count(),
    prisma.subscriber.count({ where: { active: true,  suppressedAt: null } }),
    prisma.subscriber.count({ where: { active: false } }),
    prisma.subscriber.count({ where: { convertedAt: { not: null } } }),
    prisma.subscriber.count({ where: { suppressedAt: { not: null } } }),
    prisma.subscriber.count({ where: { subscribedAt: { gte: monthStart } } }),
    prisma.subscriber.aggregate({ _sum: { failedSendCount: true } }),
    prisma.subscriber.count({ where }),
    prisma.subscriber.findMany({
      where,
      orderBy: orderBy(sort),
      skip:    (page - 1) * PAGE_SIZE,
      take:    PAGE_SIZE,
      select: {
        id: true, email: true, name: true, source: true, sourcePath: true,
        active: true, countryCode: true, country: true, language: true,
        verifiedAt: true, subscribedAt: true, lastSeenAt: true, convertedAt: true,
        failedSendCount: true, suppressedAt: true, suppressReason: true,
      },
    }),
  ]);

  const subscriberOnly = total - converted;
  const convRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";
  const failedSends = failedSendsAgg._sum.failedSendCount ?? 0;
  const totalPages = Math.ceil(filteredTotal / PAGE_SIZE);

  return (
    <div className="admin-page">

      {/* ── Header ── */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Subscribers</h1>
        <div className="subs-header-actions">
          <span className="upage-count">
            {isFiltered ? `${filteredTotal} of ${total}` : `${total} total`}
          </span>
          <a
            href="/api/admin/subscribers/export"
            className="subs-export-btn"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="ustat-row">
        <div className="ustat-cell">
          <div className="ustat-val">{total.toLocaleString()}</div>
          <div className="ustat-lbl">Total</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val ustat-val--green">{active.toLocaleString()}</div>
          <div className="ustat-lbl">Active</div>
        </div>
        <div className="ustat-cell">
          <div className={`ustat-val${inactive > 0 ? " ustat-val--warn" : ""}`}>
            {inactive.toLocaleString()}
          </div>
          <div className="ustat-lbl">Inactive</div>
        </div>
        <div className="ustat-cell">
          <div className={`ustat-val${failedSends > 0 ? " ustat-val--red" : ""}`}>
            {failedSends.toLocaleString()}
          </div>
          <div className="ustat-lbl">Failed Sends</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val ustat-val--accent">{converted.toLocaleString()}</div>
          <div className="ustat-lbl">Converted</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val ustat-val--accent">{convRate}%</div>
          <div className="ustat-lbl">Conv. Rate</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val">{subscriberOnly.toLocaleString()}</div>
          <div className="ustat-lbl">Sub. Only</div>
        </div>
        <div className="ustat-cell">
          <div className="ustat-val ustat-val--green">{newThisMonth.toLocaleString()}</div>
          <div className="ustat-lbl">New This Month</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <form method="GET" action="/admin/subscribers" className="ufilters" style={{ marginBottom: "1rem" }}>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search email, name, country…"
          className="ufilter-search"
        />
        <select name="status" defaultValue={status} className="ufilter-select">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suppressed">Suppressed</option>
          <option value="converted">Converted</option>
          <option value="subscriber">Subscriber only</option>
        </select>
        <select name="sort" defaultValue={sort} className="ufilter-select">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="fails">Failed sends</option>
          <option value="country">Country</option>
          <option value="email">Email A–Z</option>
        </select>
        <button type="submit" className="ufilter-btn">Filter</button>
        {isFiltered && (
          <Link href="/admin/subscribers" className="ufilter-clear">Clear</Link>
        )}
      </form>

      {/* ── Table ── */}
      {subscribers.length === 0 ? (
        <p className="subs-empty">No subscribers found.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Country</th>
                <th>Status</th>
                <th>Converted</th>
                <th>Subscribed</th>
                <th>Lang</th>
                <th>Verified</th>
                <th>Fails</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => {
                const isSuppressed = !!s.suppressedAt;
                const statusLabel  = isSuppressed ? "Suppressed" : s.active ? "Active" : "Inactive";
                const statusClass  = isSuppressed ? "badge--draft"
                  : s.active ? "badge--published" : "badge--draft";
                const displayCountry = s.country ?? s.countryCode ?? "—";
                return (
                  <tr key={s.id}>
                    <td className="subs-td subs-td--email">
                      <span className="subs-email">{s.email}</span>
                      {s.name && <span className="subs-name">{s.name}</span>}
                    </td>
                    <td className="subs-td">{displayCountry}</td>
                    <td className="subs-td">
                      <span className={statusClass} title={s.suppressReason ?? undefined}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="subs-td">
                      {s.convertedAt
                        ? <span className="subs-converted">Converted</span>
                        : <span className="subs-muted">Sub. only</span>}
                    </td>
                    <td className="subs-td subs-td--date">{fmtDate(s.subscribedAt)}</td>
                    <td className="subs-td subs-td--lang">
                      {s.language ? s.language.split("-")[0].toUpperCase() : "—"}
                    </td>
                    <td className="subs-td">
                      {s.verifiedAt
                        ? <span className="subs-verified">Verified</span>
                        : <span className="subs-muted">—</span>}
                    </td>
                    <td className="subs-td subs-td--num">
                      {s.failedSendCount > 0
                        ? <span className="subs-fails">{s.failedSendCount}</span>
                        : <span className="subs-muted">0</span>}
                    </td>
                    <td className="subs-td subs-td--source">
                      {s.sourcePath
                        ? <span title={s.sourcePath}>{s.source ?? "organic"}</span>
                        : (s.source ?? "organic")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="upagination">
          {page > 1 ? (
            <Link href={pageUrl(page - 1, q, status, sort)} className="upag-btn">← Prev</Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">← Prev</span>
          )}
          <span className="upag-info">
            Page {page} of {totalPages}
            {isFiltered && <span className="upag-sub"> · {filteredTotal} matching</span>}
          </span>
          {page < totalPages ? (
            <Link href={pageUrl(page + 1, q, status, sort)} className="upag-btn">Next →</Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">Next →</span>
          )}
        </div>
      )}

    </div>
  );
}
