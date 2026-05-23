import { prisma } from "@/lib/prisma";
import { createFilm, updateFilm } from "@/lib/actions/films";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (id === "new") return { title: "Admin — Add Film" };
  return { title: "Admin — Edit Film" };
}

export default async function AdminFilmFormPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === "new";

  const film = isNew
    ? null
    : await prisma.film.findUnique({ where: { id } });

  if (!isNew && !film) notFound();

  const action = isNew
    ? createFilm
    : updateFilm.bind(null, id);

  return (
    <div className="admin-form-page">
      <Link href="/admin/films" className="admin-back">
        <ChevronLeft size={15} /> All Films
      </Link>

      <h1 className="admin-page-title">
        {isNew ? "Add Film" : `Edit: ${film?.title}`}
      </h1>

      <form action={action} className="film-form">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input type="text" name="title" className="form-input"
              defaultValue={film?.title ?? ""} required placeholder="Film title" />
          </div>
          <div className="form-group">
            <label className="form-label">Genre</label>
            <input type="text" name="genre" className="form-input"
              defaultValue={film?.genre ?? ""} placeholder="e.g. Drama, Sci-Fi" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea name="description" className="form-textarea" rows={4}
            defaultValue={film?.description ?? ""}
            placeholder="Short description of the film..." />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Year</label>
            <input type="number" name="year" className="form-input"
              defaultValue={film?.year ?? ""} placeholder="2025" min={1900} max={2099} />
          </div>
          <div className="form-group">
            <label className="form-label">Duration (minutes)</label>
            <input type="number" name="duration" className="form-input"
              defaultValue={film?.duration ?? ""} placeholder="90" min={1} />
          </div>
          <div className="form-group">
            <label className="form-label">Director</label>
            <input type="text" name="director" className="form-input"
              defaultValue={film?.director ?? ""} placeholder="Director name" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Poster URL</label>
          <input type="url" name="posterUrl" className="form-input"
            defaultValue={film?.posterUrl ?? ""}
            placeholder="https://example.com/poster.jpg" />
        </div>

        <div className="form-group">
          <label className="form-label">Trailer URL</label>
          <input type="url" name="trailerUrl" className="form-input"
            defaultValue={film?.trailerUrl ?? ""}
            placeholder="https://youtube.com/watch?v=... or direct .mp4 URL" />
        </div>

        <div className="form-group">
          <label className="form-label">Full Film URL</label>
          <input type="url" name="filmUrl" className="form-input"
            defaultValue={film?.filmUrl ?? ""}
            placeholder="https://... (YouTube, Vimeo, or direct .mp4)" />
        </div>

        <div className="form-row form-row--checks">
          <label className="form-check">
            <input type="hidden" name="isPublic" value="false" />
            <input type="checkbox" name="isPublic" value="true"
              defaultChecked={film?.isPublic ?? false} />
            <span>Public — visible on Works page</span>
          </label>
          <label className="form-check">
            <input type="hidden" name="requiresAuth" value="false" />
            <input type="checkbox" name="requiresAuth" value="true"
              defaultChecked={film?.requiresAuth ?? true} />
            <span>Requires login to watch full film</span>
          </label>
        </div>

        <div className="form-actions">
          <Link href="/admin/films" className="form-cancel">Cancel</Link>
          <button type="submit" className="form-submit">
            {isNew ? "Add Film" : "Save Changes"}
          </button>
        </div>
      </form>

      <style>{`
        .admin-form-page { max-width: 720px; }
        .admin-back {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-family: var(--font-body);
          font-size: 0.8rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-brand-muted);
          text-decoration: none;
          margin-bottom: 1.5rem;
          transition: color 0.2s;
        }
        .admin-back:hover { color: var(--color-brand-white); }
        .admin-page-title {
          font-family: var(--font-display);
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0 0 2rem;
        }
        .film-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .form-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.25rem;
        }
        @media (min-width: 640px) {
          .form-row { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        }
        .form-row--checks { grid-template-columns: 1fr; gap: 0.75rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-label {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--color-brand-light);
        }
        .form-input, .form-textarea {
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--color-brand-white);
          background: var(--color-brand-surface);
          border: 1px solid var(--color-brand-border);
          border-radius: 6px;
          padding: 0.65rem 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
        }
        .form-input::placeholder, .form-textarea::placeholder { color: var(--color-brand-muted); }
        .form-input:focus, .form-textarea:focus { border-color: var(--color-brand-accent); }
        .form-check {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 0.875rem;
          color: var(--color-brand-light);
        }
        .form-check input[type="checkbox"] {
          width: 16px; height: 16px;
          accent-color: var(--color-brand-accent);
          cursor: pointer;
        }
        .form-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          padding-top: 0.5rem;
        }
        .form-cancel {
          font-family: var(--font-body);
          font-size: 0.875rem;
          color: var(--color-brand-muted);
          text-decoration: none;
          padding: 0.65rem 1.25rem;
          border: 1px solid var(--color-brand-border);
          border-radius: 6px;
          transition: color 0.2s;
        }
        .form-cancel:hover { color: var(--color-brand-white); }
        .form-submit {
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          border: none;
          border-radius: 6px;
          padding: 0.65rem 1.75rem;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .form-submit:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
