import Link from "next/link";
import { Clock, Calendar, Lock } from "lucide-react";

type FilmCardProps = {
  slug: string;
  title: string;
  posterUrl?: string | null;
  year?: number | null;
  duration?: number | null;
  genre?: string | null;
  requiresAuth?: boolean;
};

export default function FilmCard({
  slug, title, posterUrl, year, duration, genre, requiresAuth,
}: FilmCardProps) {
  return (
    <Link href={`/works/${slug}`} className="film-card">
      {/* Poster */}
      <div className="film-card-poster">
        {posterUrl ? (
          <img src={posterUrl} alt={title} className="film-card-img" loading="lazy" />
        ) : (
          <div className="film-card-placeholder">
            <span>{title.charAt(0)}</span>
          </div>
        )}
        {requiresAuth && (
          <div className="film-card-lock">
            <Lock size={12} />
          </div>
        )}
        <div className="film-card-overlay" />
      </div>

      {/* Info */}
      <div className="film-card-info">
        {genre && <span className="film-card-genre">{genre}</span>}
        <h3 className="film-card-title">{title}</h3>
        <div className="film-card-meta">
          {year && (
            <span className="film-card-meta-item">
              <Calendar size={11} />{year}
            </span>
          )}
          {duration && (
            <span className="film-card-meta-item">
              <Clock size={11} />{Math.floor(duration / 60)}h {duration % 60}m
            </span>
          )}
        </div>
      </div>

      <style>{`
        .film-card {
          display: block;
          text-decoration: none;
          background: var(--color-brand-dark);
          border: 1px solid var(--color-brand-border);
          border-radius: 8px;
          overflow: hidden;
          transition: transform 0.25s ease, border-color 0.25s ease;
        }
        .film-card:hover {
          transform: translateY(-4px);
          border-color: var(--color-brand-accent);
        }
        .film-card-poster {
          position: relative;
          aspect-ratio: 2/3;
          overflow: hidden;
          background: var(--color-brand-surface);
        }
        .film-card-img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.4s ease;
        }
        .film-card:hover .film-card-img { transform: scale(1.04); }
        .film-card-placeholder {
          width: 100%; height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 4rem;
          font-weight: 900;
          color: var(--color-brand-border);
        }
        .film-card-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(10,10,10,0.7) 0%, transparent 50%);
        }
        .film-card-lock {
          position: absolute;
          top: 0.6rem; right: 0.6rem;
          background: rgba(10,10,10,0.8);
          color: var(--color-brand-accent);
          border-radius: 4px;
          padding: 0.25rem;
          display: flex;
          align-items: center;
        }
        .film-card-info { padding: 0.9rem 1rem 1rem; }
        .film-card-genre {
          font-family: var(--font-body);
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-brand-accent);
          display: block;
          margin-bottom: 0.3rem;
        }
        .film-card-title {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-brand-white);
          margin: 0 0 0.5rem;
          line-height: 1.3;
        }
        .film-card-meta {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .film-card-meta-item {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-family: var(--font-body);
          font-size: 0.72rem;
          color: var(--color-brand-muted);
        }
      `}</style>
    </Link>
  );
}
