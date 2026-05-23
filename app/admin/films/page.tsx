import { prisma } from "@/lib/prisma";
import { toggleFilmVisibility, deleteFilm } from "@/lib/actions/films";
import Link from "next/link";
import { Plus, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Films" };

export default async function AdminFilmsPage() {
  const films = await prisma.film.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, isPublic: true,
      genre: true, year: true, trailerUrl: true, filmUrl: true, createdAt: true,
    },
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Films</h1>
        <Link href="/admin/films/new" className="admin-add-btn">
          <Plus size={15} /> Add Film
        </Link>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Genre</th>
              <th>Year</th>
              <th>Trailer</th>
              <th>Full Film</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {films.map((f) => (
              <tr key={f.id}>
                <td className="td-title">{f.title}</td>
                <td>{f.genre ?? "—"}</td>
                <td>{f.year ?? "—"}</td>
                <td>
                  <span className={`dot ${f.trailerUrl ? "dot--green" : "dot--red"}`} />
                </td>
                <td>
                  <span className={`dot ${f.filmUrl ? "dot--green" : "dot--red"}`} />
                </td>
                <td>
                  <span className={`status-badge ${f.isPublic ? "status-badge--public" : "status-badge--private"}`}>
                    {f.isPublic ? "Public" : "Private"}
                  </span>
                </td>
                <td>
                  <div className="action-btns">
                    <Link href={`/admin/films/${f.id}`} className="action-btn" title="Edit">
                      <Pencil size={14} />
                    </Link>
                    <form action={toggleFilmVisibility.bind(null, f.id, !f.isPublic)}>
                      <button type="submit" className="action-btn" title={f.isPublic ? "Make Private" : "Make Public"}>
                        {f.isPublic ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </form>
                    <form action={deleteFilm.bind(null, f.id)}
                      onSubmit={(e) => { if (!confirm(`Delete "${f.title}"?`)) e.preventDefault(); }}>
                      <button type="submit" className="action-btn action-btn--danger" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {films.length === 0 && (
              <tr><td colSpan={7} className="table-empty">No films yet. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .admin-page { max-width: 1000px; }
        .admin-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .admin-page-title {
          font-family: var(--font-display);
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0;
        }
        .admin-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-family: var(--font-body);
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          padding: 0.55rem 1.1rem;
          border-radius: 6px;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .admin-add-btn:hover { opacity: 0.85; }
        .admin-table-wrap {
          background: var(--color-brand-dark);
          border: 1px solid var(--color-brand-border);
          border-radius: 8px;
          overflow-x: auto;
        }
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-body);
          font-size: 0.875rem;
        }
        .admin-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          color: var(--color-brand-muted);
          font-weight: 500;
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--color-brand-border);
          white-space: nowrap;
        }
        .admin-table td {
          padding: 0.75rem 1rem;
          color: var(--color-brand-light);
          border-bottom: 1px solid rgba(42,42,42,0.5);
          vertical-align: middle;
        }
        .admin-table tr:last-child td { border-bottom: none; }
        .td-title { font-weight: 500; color: var(--color-brand-white); max-width: 200px; }
        .dot {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
        }
        .dot--green { background: #27ae60; }
        .dot--red   { background: var(--color-brand-border); }
        .status-badge {
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.2rem 0.6rem;
          border-radius: 3px;
          white-space: nowrap;
        }
        .status-badge--public  { background: rgba(39,174,96,0.15);  color: #27ae60; }
        .status-badge--private { background: rgba(107,114,128,0.15); color: var(--color-brand-muted); }
        .action-btns { display: flex; gap: 0.4rem; align-items: center; }
        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px; height: 28px;
          background: var(--color-brand-surface);
          border: 1px solid var(--color-brand-border);
          border-radius: 5px;
          color: var(--color-brand-muted);
          text-decoration: none;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .action-btn:hover { color: var(--color-brand-white); border-color: var(--color-brand-white); }
        .action-btn--danger:hover { color: #e74c3c; border-color: #e74c3c; }
        .table-empty { text-align: center; color: var(--color-brand-muted); padding: 3rem; }
      `}</style>
    </div>
  );
}
