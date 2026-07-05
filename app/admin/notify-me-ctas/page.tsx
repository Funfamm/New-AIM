import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BellRing, Plus, CheckCircle2, Circle, Pencil, Users } from "lucide-react";
import type { Metadata } from "next";
import "./notify-me-ctas.css";

export const metadata: Metadata = { title: "Admin — Notify Me CTAs" };

const CTA_TYPE_LABEL: Record<string, string> = {
  RELEASE: "Pre-Release",
  MORE: "Watch More",
  POST_RELEASE: "Post-Release",
};

export default async function NotifyMeCtasPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string; status?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/login");

  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const typeFilter   = sp.type   ?? "";
  const statusFilter = sp.status ?? "";

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ── Summary stats (unfiltered) ────────────────────────────────────────
  const [totalCtas, activeCtas, totalSignupsRow, recentSignupsRow] = await Promise.all([
    prisma.notifyMeCta.count(),
    prisma.notifyMeCta.count({ where: { isEnabled: true } }),
    prisma.notifyMeSignup.count(),
    prisma.notifyMeSignup.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);

  // ── Filtered CTAs ─────────────────────────────────────────────────────
  const ctas = await prisma.notifyMeCta.findMany({
    where: {
      ...(typeFilter ? { type: typeFilter as "RELEASE" | "MORE" | "POST_RELEASE" } : {}),
      ...(statusFilter === "active" ? { isEnabled: true } : {}),
      ...(statusFilter === "off" ? { isEnabled: false } : {}),
      ...(search ? { work: { title: { contains: search, mode: "insensitive" } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, isEnabled: true,
      headline: true, ctaLabel: true, triggerSecondsFromEnd: true,
      createdAt: true,
      work: { select: { id: true, title: true, type: true, slug: true } },
      _count: { select: { signups: true } },
    },
  });

  const ctaIds = ctas.map((c) => c.id);

  const [recentCounts, guestCounts, memberCounts, sentCounts, pendingCounts, inAppCounts, failedCounts] =
    await Promise.all([
      prisma.notifyMeSignup.groupBy({ by: ["ctaId"], where: { ctaId: { in: ctaIds }, createdAt: { gte: sevenDaysAgo } }, _count: { id: true } }),
      prisma.notifyMeSignup.groupBy({ by: ["ctaId"], where: { ctaId: { in: ctaIds }, userId: null }, _count: { id: true } }),
      prisma.notifyMeSignup.groupBy({ by: ["ctaId"], where: { ctaId: { in: ctaIds }, userId: { not: null } }, _count: { id: true } }),
      prisma.notifyMeSignup.groupBy({ by: ["ctaId"], where: { ctaId: { in: ctaIds }, notifyEmailSentAt: { not: null } }, _count: { id: true } }),
      prisma.notifyMeSignup.groupBy({ by: ["ctaId"], where: { ctaId: { in: ctaIds }, notifyEmailSentAt: null }, _count: { id: true } }),
      prisma.notifyMeSignup.groupBy({ by: ["ctaId"], where: { ctaId: { in: ctaIds }, notifyInAppSentAt: { not: null } }, _count: { id: true } }),
      prisma.notifyMeSignup.groupBy({ by: ["ctaId"], where: { ctaId: { in: ctaIds }, notifyFailCount: { gt: 0 } }, _count: { id: true } }),
    ]);

  const toMap = (rows: { ctaId: string | null; _count: { id: number } }[]) =>
    new Map(rows.filter((r) => r.ctaId !== null).map((r) => [r.ctaId!, r._count.id]));

  const recentMap  = toMap(recentCounts);
  const guestMap   = toMap(guestCounts);
  const memberMap  = toMap(memberCounts);
  const sentMap    = toMap(sentCounts);
  const pendingMap = toMap(pendingCounts);
  const inAppMap   = toMap(inAppCounts);
  const failedMap  = toMap(failedCounts);

  const isFiltered = !!(search || typeFilter || statusFilter);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Notify Me CTAs</h1>
        <Link href="/admin/notify-me-ctas/new" className="admin-add-btn">
          <Plus size={15} /> New CTA
        </Link>
      </div>

      {/* Stat cards */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-card--gold">
          <span className="admin-stat-value">{totalCtas}</span>
          <span className="admin-stat-label">Total CTAs</span>
        </div>
        <div className="admin-stat-card admin-stat-card--green">
          <span className="admin-stat-value">{activeCtas}</span>
          <span className="admin-stat-label">Active</span>
        </div>
        <div className="admin-stat-card admin-stat-card--blue">
          <span className="admin-stat-value">{totalSignupsRow}</span>
          <span className="admin-stat-label">Total Signups</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-value">{recentSignupsRow}</span>
          <span className="admin-stat-label">Last 7 Days</span>
        </div>
      </div>

      {/* Filter bar */}
      <form method="get" className="admin-filter-bar">
        <div className="admin-filter-search-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            name="search"
            className="admin-filter-search"
            placeholder="Search by work title…"
            defaultValue={search}
          />
        </div>
        <select name="type" className="admin-filter-select" defaultValue={typeFilter}>
          <option value="">All types</option>
          <option value="RELEASE">Pre-Release</option>
          <option value="MORE">Watch More</option>
          <option value="POST_RELEASE">Post-Release</option>
        </select>
        <select name="status" className="admin-filter-select" defaultValue={statusFilter}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="off">Off</option>
        </select>
        <button type="submit" className="admin-filter-btn">Filter</button>
        {isFiltered && (
          <Link href="/admin/notify-me-ctas" className="admin-filter-clear">Clear</Link>
        )}
        <span className="admin-filter-count">{ctas.length} result{ctas.length !== 1 ? "s" : ""}</span>
      </form>

      {ctas.length === 0 && !isFiltered ? (
        <div className="admin-table-wrap">
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">
              <BellRing size={22} />
            </div>
            <p className="admin-empty-state-title">No CTAs yet</p>
            <p className="admin-empty-state-text">
              Create a CTA to start capturing signups during playback.
            </p>
            <Link href="/admin/notify-me-ctas/new" className="admin-add-btn" style={{ marginTop: "0.5rem" }}>
              <Plus size={14} /> New CTA
            </Link>
          </div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table nmc-table">
            <thead>
              <tr>
                <th>Work</th>
                <th>Type</th>
                <th>Status</th>
                <th>Signups</th>
                <th>Delivery</th>
                <th>Last 7 Days</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ctas.map((cta) => {
                const total   = cta._count.signups;
                const guest   = guestMap.get(cta.id)   ?? 0;
                const member  = memberMap.get(cta.id)  ?? 0;
                const sent    = sentMap.get(cta.id)    ?? 0;
                const pending = pendingMap.get(cta.id) ?? 0;
                const inApp   = inAppMap.get(cta.id)   ?? 0;
                const failed  = failedMap.get(cta.id)  ?? 0;

                return (
                  <tr key={cta.id}>
                    <td>
                      <div className="nmc-work-cell">
                        <span className="nmc-work-title">{cta.work.title}</span>
                        <span className="nmc-work-type">{cta.work.type.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td>
                      <span className="nmc-type-chip">{CTA_TYPE_LABEL[cta.type] ?? cta.type}</span>
                    </td>
                    <td>
                      {cta.isEnabled ? (
                        <span className="nmc-status nmc-status--active">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="nmc-status nmc-status--off">
                          <Circle size={12} /> Off
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="nmc-signup-cell">
                        <span className="nmc-signup-total">{total}</span>
                        {total > 0 && (
                          <span className="nmc-signup-breakdown">{guest}g · {member}m</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {total === 0 ? (
                        <span className="nmc-delivery-none">—</span>
                      ) : (
                        <div className="nmc-delivery-cell">
                          {sent    > 0 && <span className="nmc-delivery-chip nmc-delivery-chip--sent">{sent} queued</span>}
                          {pending > 0 && <span className="nmc-delivery-chip nmc-delivery-chip--pending">{pending} pending</span>}
                          {inApp   > 0 && <span className="nmc-delivery-chip nmc-delivery-chip--inapp">{inApp} in‑app</span>}
                          {failed  > 0 && <span className="nmc-delivery-chip nmc-delivery-chip--failed">{failed} failed</span>}
                        </div>
                      )}
                    </td>
                    <td className="nmc-num">{recentMap.get(cta.id) ?? 0}</td>
                    <td>
                      <div className="nmc-actions-cell">
                        <Link href={`/admin/notify-me-ctas/${cta.id}`} className="nmc-edit-btn" aria-label={`Edit CTA for ${cta.work.title}`}>
                          <Pencil size={12} /> Edit
                        </Link>
                        {total > 0 && (
                          <Link href={`/admin/notify-me-ctas/${cta.id}/signups`} className="nmc-signups-btn" aria-label={`View signups for ${cta.work.title}`}>
                            <Users size={12} /> Signups
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {ctas.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="admin-empty-state">
                      <div className="admin-empty-state-icon"><BellRing size={22} /></div>
                      <p className="admin-empty-state-title">No CTAs match your filters</p>
                      <p className="admin-empty-state-text">Try adjusting the search or filter criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
