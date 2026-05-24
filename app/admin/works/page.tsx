import { prisma } from "@/lib/prisma";
import { setWorkStatus } from "@/lib/actions/works";
import { DeleteWorkButton } from "@/components/delete-work-button";
import Link from "next/link";
import { Plus, Pencil, Eye, EyeOff } from "lucide-react";
import type { Metadata } from "next";
import type { WorkType, WorkStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Admin — Works" };

const TYPE_LABELS: Record<WorkType, string> = {
  SHORT_FILM: "Short Film", FULL_FILM: "Full Film", SERIES: "Series",
  EPISODE: "Episode", TRAILER: "Trailer", COMMERCIAL: "Commercial",
  BRANDING: "Branding", CAMPAIGN: "Campaign", CASE_STUDY: "Case Study",
};

const STATUS_CLASS: Record<WorkStatus, string> = {
  PUBLISHED: "badge--published",
  DRAFT:     "badge--draft",
  PRIVATE:   "badge--private",
};

export default async function AdminWorksPage() {
  const works = await prisma.work.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, type: true, status: true,
      featured: true, showOnHome: true, clientName: true, genre: true,
      videoUrl: true, trailerUrl: true, createdAt: true,
    },
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Works</h1>
        <Link href="/admin/works/new" className="admin-add-btn">
          <Plus size={15} /> Add Work
        </Link>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Video</th>
              <th>Featured</th>
              <th>Home</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {works.map((w) => {
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
                      {w.status.toLowerCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`dot ${w.videoUrl || w.trailerUrl ? "dot--green" : "dot--red"}`} />
                  </td>
                  <td>{w.featured ? <span className="check">✓</span> : <span className="dash">—</span>}</td>
                  <td>{w.showOnHome ? <span className="check">✓</span> : <span className="dash">—</span>}</td>
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
            {works.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">No works yet. Add one above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .td-title { font-weight: 500; color: var(--color-brand-white); max-width: 220px; }
        .td-sub { display: block; font-size: 0.75rem; color: var(--color-brand-muted); font-weight: 400; margin-top: 0.15rem; }
        .type-label {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 500;
          color: var(--color-brand-muted); white-space: nowrap;
        }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
        .dot--green { background: #4ade80; }
        .dot--red   { background: var(--color-brand-border); }
        .check { color: #4ade80; font-size: 0.9rem; }
        .dash  { color: var(--color-brand-border); }
      `}</style>
    </div>
  );
}
