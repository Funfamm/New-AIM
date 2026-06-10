import { prisma } from "@/lib/prisma";
import { setWorkStatus } from "@/lib/actions/works";
import { DeleteWorkButton } from "@/components/delete-work-button";
import Link from "next/link";
import "./admin-works.css";
import { Plus, Pencil, Eye, EyeOff, Heart, Share2, Film } from "lucide-react";
import type { Metadata } from "next";
import type { WorkType, WorkStatus } from "@prisma/client";
import WorkerStatus from "@/components/admin/worker-status";
import WorksFilterBar from "@/components/admin/works-filter-bar";

export const metadata: Metadata = { title: "Admin — Works" };

const TYPE_LABELS: Record<WorkType, string> = {
  SHORT_FILM: "Short Film", FULL_FILM: "Full Film", SERIES: "Series",
  EPISODE: "Episode", TRAILER: "Trailer", COMMERCIAL: "Commercial",
  BRANDING: "Branding", CAMPAIGN: "Campaign", CASE_STUDY: "Case Study",
};

const STATUS_CLASS: Record<WorkStatus, string> = {
  PUBLISHED:     "badge--published",
  DRAFT:         "badge--draft",
  PRIVATE:       "badge--private",
  IN_PRODUCTION: "badge--production",
  UPCOMING:      "badge--upcoming",
};

const WORK_TYPES: WorkType[] = [
  "SHORT_FILM","FULL_FILM","SERIES","TRAILER","COMMERCIAL","BRANDING","CAMPAIGN","CASE_STUDY",
];
const WORK_STATUSES: WorkStatus[] = ["PUBLISHED","DRAFT","PRIVATE","IN_PRODUCTION","UPCOMING"];

export default async function AdminWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const typeFilter  = (WORK_TYPES.includes(sp.type  as WorkType)  ? sp.type  : "") as WorkType | "";
  const statusFilter = (WORK_STATUSES.includes(sp.status as WorkStatus) ? sp.status : "") as WorkStatus | "";

  // ── Total counts for stat cards (unfiltered) ────────────────────────────
  const [totalCount, publishedCount, draftCount, seriesCount] = await Promise.all([
    prisma.work.count({ where: { type: { not: "EPISODE" } } }),
    prisma.work.count({ where: { type: { not: "EPISODE" }, status: "PUBLISHED" } }),
    prisma.work.count({ where: { type: { not: "EPISODE" }, status: "DRAFT" } }),
    prisma.work.count({ where: { type: "SERIES" } }),
  ]);

  // ── Filtered works query ─────────────────────────────────────────────────
  const works = await prisma.work.findMany({
    where: {
      type: typeFilter ? { equals: typeFilter } : { not: "EPISODE" },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, type: true, status: true,
      featured: true, showOnHome: true, clientName: true, genre: true,
      videoUrl: true, trailerUrl: true, previewClipUrl: true, createdAt: true,
      episodes: { select: { id: true } },
    },
  });

  // ── Like + share aggregation ─────────────────────────────────────────────
  const allIds = works.flatMap((w) => [w.id, ...w.episodes.map((e) => e.id)]);

  const [likeRows, shareRows] = await Promise.all([
    prisma.workLike.groupBy({
      by: ["workId"],
      where: { workId: { in: allIds } },
      _count: { _all: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["workId"],
      where: { type: "SHARE_WORK", workId: { in: allIds } },
      _count: { _all: true },
    }),
  ]);

  const likeMap  = new Map(likeRows.map((r) => [r.workId, r._count._all]));
  const shareMap = new Map(shareRows.filter((r) => r.workId != null).map((r) => [r.workId!, r._count._all]));

  const worksWithStats = works.map((w) => {
    const ids = [w.id, ...w.episodes.map((e) => e.id)];
    return {
      ...w,
      totalLikes:  ids.reduce((s, id) => s + (likeMap.get(id)  ?? 0), 0),
      totalShares: ids.reduce((s, id) => s + (shareMap.get(id) ?? 0), 0),
    };
  });

  const isFiltered = !!(search || typeFilter || statusFilter);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Works</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <WorkerStatus />
          <Link href="/admin/works/new" className="admin-add-btn">
            <Plus size={15} /> Add Work
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-card--gold">
          <span className="admin-stat-value">{totalCount}</span>
          <span className="admin-stat-label">Total Works</span>
        </div>
        <div className="admin-stat-card admin-stat-card--green">
          <span className="admin-stat-value">{publishedCount}</span>
          <span className="admin-stat-label">Published</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-value">{draftCount}</span>
          <span className="admin-stat-label">Drafts</span>
        </div>
        <div className="admin-stat-card admin-stat-card--blue">
          <span className="admin-stat-value">{seriesCount}</span>
          <span className="admin-stat-label">Series</span>
        </div>
      </div>

      {/* Filter bar */}
      <WorksFilterBar
        search={search}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        typeOptions={WORK_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
        statusOptions={WORK_STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g," ") }))}
        resultCount={works.length}
        isFiltered={isFiltered}
      />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th title="Main video">Video</th>
              <th title="Trailer">Trailer</th>
              <th title="Preview clip">Preview</th>
              <th>Featured</th>
              <th>Home</th>
              <th className="th-stat" title="Likes">
                <Heart size={12} />
              </th>
              <th className="th-stat" title="Shares">
                <Share2 size={12} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {worksWithStats.map((w) => {
              const nextStatus: WorkStatus = w.status === "PUBLISHED" ? "PRIVATE" : "PUBLISHED";
              return (
                <tr key={w.id}>
                  <td className="td-title">
                    {w.title}
                    {w.clientName && (
                      <span className="td-sub">{w.clientName}</span>
                    )}
                  </td>
                  <td>
                    <span className="type-label">{TYPE_LABELS[w.type]}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${STATUS_CLASS[w.status]}`}>
                      {w.status.toLowerCase().replace(/_/g," ")}
                    </span>
                  </td>
                  <td>
                    <span className={`dot ${w.videoUrl ? "dot--green" : "dot--red"}`} />
                  </td>
                  <td>
                    <span className={`dot ${w.trailerUrl ? "dot--green" : "dot--empty"}`} />
                  </td>
                  <td>
                    <span className={`dot ${w.previewClipUrl ? "dot--green" : "dot--empty"}`} />
                  </td>
                  <td>{w.featured ? <span className="check">✓</span> : <span className="dash">—</span>}</td>
                  <td>{w.showOnHome ? <span className="check">✓</span> : <span className="dash">—</span>}</td>
                  <td className="td-stat">
                    {w.totalLikes > 0 ? (
                      <span className="stat-val">
                        {w.totalLikes}
                        {w.type === "SERIES" && w.episodes.length > 0 && (
                          <span className="stat-agg" title={`Includes ${w.episodes.length} episode(s)`}>*</span>
                        )}
                      </span>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </td>
                  <td className="td-stat">
                    {w.totalShares > 0 ? (
                      <span className="stat-val">
                        {w.totalShares}
                        {w.type === "SERIES" && w.episodes.length > 0 && (
                          <span className="stat-agg" title={`Includes ${w.episodes.length} episode(s)`}>*</span>
                        )}
                      </span>
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </td>
                  <td>
                    <div className="action-btns">
                      <Link href={`/admin/works/${w.id}`} className="action-btn" title="Edit">
                        <Pencil size={14} />
                      </Link>
                      <form action={setWorkStatus.bind(null, w.id, nextStatus)}>
                        <button
                          type="submit"
                          className="action-btn"
                          title={w.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        >
                          {w.status === "PUBLISHED" ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </form>
                      <DeleteWorkButton id={w.id} title={w.title} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {worksWithStats.length === 0 && (
              <tr>
                <td colSpan={11}>
                  {isFiltered ? (
                    <div className="admin-empty-state">
                      <div className="admin-empty-state-icon">
                        <Film size={22} />
                      </div>
                      <p className="admin-empty-state-title">No works match your filters</p>
                      <p className="admin-empty-state-text">
                        Try adjusting the search or filter criteria.
                      </p>
                    </div>
                  ) : (
                    <div className="admin-empty-state">
                      <div className="admin-empty-state-icon">
                        <Film size={22} />
                      </div>
                      <p className="admin-empty-state-title">No works yet</p>
                      <p className="admin-empty-state-text">
                        Add your first work to get started.
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
