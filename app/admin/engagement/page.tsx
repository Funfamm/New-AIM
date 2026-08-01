import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Metadata } from "next";
import type { WorkType } from "@prisma/client";
import EngagementFilterBar from "@/components/admin/engagement-filter-bar";
import "./engagement.css";

export const metadata: Metadata = { title: "Admin — Engagement" };

const WORK_TYPE_LABELS: Record<string, string> = {
  FULL_FILM: "Full Film", SHORT_FILM: "Short Film", SERIES: "Series",
  EPISODE: "Episode", TRAILER: "Trailer", COMMERCIAL: "Commercial",
  BRANDING: "Branding", CAMPAIGN: "Campaign", CASE_STUDY: "Case Study",
};

type Props = { searchParams: Promise<{ type?: string; search?: string; cursor?: string }> };

const PAGE = 30;

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminEngagementPage({ searchParams }: Props) {
  await requireAdmin();
  const { type: typeFilter, search, cursor } = await searchParams;

  const likeWhere: Record<string, unknown> = {};
  if (typeFilter) likeWhere.work = { type: typeFilter as WorkType };
  if (search) {
    likeWhere.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [likes, totalLikes, totalComments, totalSaves, topWorks, processClicks, guideDownloads, processByWork] = await Promise.all([
    prisma.workLike.findMany({
      where: likeWhere,
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        work: { select: { id: true, slug: true, title: true, type: true } },
      },
    }),
    prisma.workLike.count(),
    prisma.comment.count({ where: { status: "PUBLISHED" } }),
    prisma.savedWork.count(),
    prisma.work.findMany({
      where: {
        status: "PUBLISHED",
        ...(typeFilter ? { type: typeFilter as WorkType } : {}),
        likes: { some: {} },
      },
      orderBy: { likes: { _count: "desc" } },
      take: 8,
      select: {
        id: true, slug: true, title: true, type: true,
        _count: { select: { likes: true } },
      },
    }),
    prisma.analyticsEvent.count({ where: { type: "PROCESS_CLICK" } }),
    prisma.analyticsEvent.count({ where: { type: "GUIDE_DOWNLOAD" } }),
    prisma.analyticsEvent.groupBy({
      by: ["workId"],
      where: { type: "PROCESS_CLICK", workId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { workId: "desc" } },
      take: 8,
    }),
  ]);

  // Titles for the per-work "How We Made It" click ranking
  const processWorkIds = processByWork.map((r) => r.workId).filter((id): id is string => !!id);
  const processWorks = processWorkIds.length > 0
    ? await prisma.work.findMany({
        where: { id: { in: processWorkIds } },
        select: { id: true, slug: true, title: true, type: true },
        take: 8,
      })
    : [];
  const processWorkById = new Map(processWorks.map((w) => [w.id, w]));

  const hasMore = likes.length > PAGE;
  if (hasMore) likes.pop();
  const nextCursor = hasMore ? likes[likes.length - 1]?.id : null;
  const isFiltered = !!(typeFilter || search);

  const typeOptions = Object.entries(WORK_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Engagement</h1>
          <p className="eng-subtitle">Likes, saves, comments, and production-guide interest across all works.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-card--gold">
          <span className="admin-stat-value">{totalLikes.toLocaleString()}</span>
          <span className="admin-stat-label">Total Likes</span>
        </div>
        <div className="admin-stat-card admin-stat-card--blue">
          <span className="admin-stat-value">{totalComments.toLocaleString()}</span>
          <span className="admin-stat-label">Published Comments</span>
        </div>
        <div className="admin-stat-card admin-stat-card--green">
          <span className="admin-stat-value">{totalSaves.toLocaleString()}</span>
          <span className="admin-stat-label">Saved Works</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-value">{topWorks.length}</span>
          <span className="admin-stat-label">Works w/ Likes</span>
        </div>
        <div className="admin-stat-card admin-stat-card--gold">
          <span className="admin-stat-value">{processClicks.toLocaleString()}</span>
          <span className="admin-stat-label">How We Made It Clicks</span>
        </div>
        <div className="admin-stat-card admin-stat-card--blue">
          <span className="admin-stat-value">{guideDownloads.toLocaleString()}</span>
          <span className="admin-stat-label">Guide Downloads</span>
        </div>
      </div>

      {/* Top works */}
      {topWorks.length > 0 && (
        <div className="admin-table-wrap eng-top-wrap">
          <div className="eng-top-header">
            <span className="eng-top-title">Most Liked</span>
          </div>
          {topWorks.map((w, i) => (
            <div key={w.id} className="eng-top-row">
              <span className="eng-top-rank">{i + 1}</span>
              <Link href={`/works/${w.slug}`} className="eng-top-link" target="_blank" rel="noopener">
                {w.title}
              </Link>
              <span className="eng-top-type">{WORK_TYPE_LABELS[w.type] ?? w.type}</span>
              <span className="eng-top-count">♥ {w._count.likes}</span>
            </div>
          ))}
        </div>
      )}

      {/* How We Made It clicks by work */}
      {processByWork.length > 0 && (
        <div className="admin-table-wrap eng-top-wrap">
          <div className="eng-top-header">
            <span className="eng-top-title">How We Made It — Clicks by Work</span>
          </div>
          {processByWork.map((r, i) => {
            const w = r.workId ? processWorkById.get(r.workId) : undefined;
            if (!w) return null;
            return (
              <div key={r.workId} className="eng-top-row">
                <span className="eng-top-rank">{i + 1}</span>
                <Link href={`/works/${w.slug}`} className="eng-top-link" target="_blank" rel="noopener">
                  {w.title}
                </Link>
                <span className="eng-top-type">{WORK_TYPE_LABELS[w.type] ?? w.type}</span>
                <span className="eng-top-count">🎬 {r._count._all}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter bar — no native select */}
      <EngagementFilterBar
        typeFilter={typeFilter ?? ""}
        search={search ?? ""}
        typeOptions={typeOptions}
        isFiltered={isFiltered}
        resultCount={likes.length + (hasMore ? 1 : 0)}
      />

      {/* Likes table */}
      <div className="eng-table-label">
        Who Liked{isFiltered ? " — filtered" : ""}
        <span className="eng-table-count">{likes.length}{hasMore ? "+" : ""}</span>
      </div>

      {likes.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </div>
            <p className="admin-empty-state-title">No likes match your filter</p>
            <p className="admin-empty-state-text">Try adjusting your search or filter criteria.</p>
          </div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Work</th>
                <th>Type</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {likes.map((l) => (
                <tr key={l.id}>
                  <td className="eng-cell-primary">{l.user.name ?? "—"}</td>
                  <td className="eng-cell-muted">{l.user.email}</td>
                  <td>
                    <Link href={`/works/${l.work.slug}`} className="eng-work-link" target="_blank" rel="noopener">
                      {l.work.title.length > 40 ? l.work.title.slice(0, 40) + "…" : l.work.title}
                    </Link>
                  </td>
                  <td className="eng-cell-muted">{WORK_TYPE_LABELS[l.work.type] ?? l.work.type}</td>
                  <td className="eng-cell-muted">{timeAgo(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(cursor || nextCursor) && (
        <div className="upagination">
          {cursor ? (
            <Link
              href={`/admin/engagement?${new URLSearchParams({ ...(typeFilter ? { type: typeFilter } : {}), ...(search ? { search } : {}) }).toString()}`}
              className="upag-btn"
            >
              ← First page
            </Link>
          ) : (
            <span className="upag-btn upag-btn--disabled">← First page</span>
          )}
          {nextCursor && (
            <Link
              href={`/admin/engagement?${new URLSearchParams({ ...(typeFilter ? { type: typeFilter } : {}), ...(search ? { search } : {}), cursor: nextCursor }).toString()}`}
              className="upag-btn"
            >
              Next {PAGE} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
