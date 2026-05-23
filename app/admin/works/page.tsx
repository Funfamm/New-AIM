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
        .admin-page { max-width: 1100px; }
        .admin-page-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;
        }
        .admin-page-title {
          font-family: var(--font-display); font-size: 1.8rem;
          font-weight: 700; color: var(--color-brand-white); margin: 0;
        }
        .admin-add-btn {
          display: inline-flex; align-items: center; gap: 0.4rem;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 600;
          color: var(--color-brand-black); background: var(--color-brand-accent);
          padding: 0.55rem 1.1rem; border-radius: 4px; text-decoration: none;
          transition: filter 0.2s;
        }
        .admin-add-btn:hover { filter: brightness(1.05); }
        .admin-table-wrap {
          background: var(--color-brand-dark); border: 1px solid var(--color-brand-border);
          border-radius: 6px; overflow-x: auto;
        }
        .admin-table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 0.875rem; }
        .admin-table th {
          text-align: left; padding: 0.75rem 1rem; color: var(--color-brand-muted);
          font-weight: 500; font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase;
          border-bottom: 1px solid var(--color-brand-border); white-space: nowrap;
        }
        .admin-table td {
          padding: 0.75rem 1rem; color: var(--color-brand-light);
          border-bottom: 1px solid rgba(42,42,42,0.5); vertical-align: middle;
        }
        .admin-table tr:last-child td { border-bottom: none; }
        .td-title { font-weight: 500; color: var(--color-brand-white); max-width: 220px; }
        .td-sub { display: block; font-size: 0.75rem; color: var(--color-brand-muted); font-weight: 400; margin-top: 0.15rem; }
        .type-label {
          font-family: var(--font-body); font-size: 0.7rem; font-weight: 500;
          color: var(--color-brand-muted); white-space: nowrap;
        }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
        .dot--green { background: #27ae60; }
        .dot--red   { background: var(--color-brand-border); }
        .status-badge {
          font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em;
          text-transform: uppercase; padding: 0.2rem 0.55rem; border-radius: 3px; white-space: nowrap;
        }
        .badge--published { background: rgba(39,174,96,0.15);  color: #27ae60; }
        .badge--draft     { background: rgba(107,114,128,0.12); color: var(--color-brand-muted); }
        .badge--private   { background: rgba(192,57,43,0.12);   color: #e07060; }
        .check { color: #27ae60; font-size: 0.9rem; }
        .dash  { color: var(--color-brand-border); }
        .action-btns { display: flex; gap: 0.4rem; align-items: center; }
        .action-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; background: var(--color-brand-surface);
          border: 1px solid var(--color-brand-border); border-radius: 4px;
          color: var(--color-brand-muted); text-decoration: none;
          cursor: pointer; transition: color 0.15s, border-color 0.15s;
        }
        .action-btn:hover { color: var(--color-brand-white); border-color: var(--color-brand-white); }
        .action-btn--danger:hover { color: #e74c3c; border-color: #e74c3c; }
        .table-empty { text-align: center; color: var(--color-brand-muted); padding: 3rem; }
      `}</style>
    </div>
  );
}
