import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Play, Clock, Calendar, ChevronLeft, Lock } from "lucide-react";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const film = await prisma.film.findUnique({ where: { slug }, select: { title: true, description: true } });
  if (!film) return { title: "Film Not Found" };
  return { title: film.title, description: film.description ?? undefined };
}

async function getFilm(slug: string) {
  return prisma.film.findUnique({
    where: { slug, isPublic: true },
    select: {
      id: true, slug: true, title: true, description: true,
      posterUrl: true, trailerUrl: true, filmUrl: true,
      year: true, duration: true, genre: true, director: true,
      requiresAuth: true,
    },
  });
}

export default async function FilmDetailPage({ params }: Props) {
  const { slug } = await params;
  const film = await getFilm(slug);
  if (!film) notFound();

  return (
    <main className="detail-page">
      {/* Hero backdrop */}
      <div className="detail-backdrop">
        {film.posterUrl && (
          <img src={film.posterUrl} alt="" className="detail-backdrop-img" aria-hidden />
        )}
        <div className="detail-backdrop-gradient" />
      </div>

      <div className="container-app detail-content">
        {/* Back link */}
        <Link href="/works" className="detail-back">
          <ChevronLeft size={16} /> All Works
        </Link>

        <div className="detail-layout">
          {/* Poster */}
          <div className="detail-poster-wrap">
            {film.posterUrl ? (
              <img src={film.posterUrl} alt={film.title} className="detail-poster" />
            ) : (
              <div className="detail-poster-placeholder">
                <span>{film.title.charAt(0)}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="detail-info">
            {film.genre && <span className="detail-genre">{film.genre}</span>}
            <h1 className="detail-title">{film.title}</h1>

            <div className="detail-meta">
              {film.year && (
                <span className="detail-meta-item"><Calendar size={13} />{film.year}</span>
              )}
              {film.duration && (
                <span className="detail-meta-item">
                  <Clock size={13} />{Math.floor(film.duration / 60)}h {film.duration % 60}m
                </span>
              )}
              {film.director && (
                <span className="detail-meta-item">Dir. {film.director}</span>
              )}
            </div>

            {film.description && (
              <p className="detail-desc">{film.description}</p>
            )}

            {/* Actions */}
            <div className="detail-actions">
              {film.trailerUrl && (
                <Link href={`/watch/${film.slug}`} className="detail-btn-primary">
                  <Play size={15} fill="currentColor" /> Watch Trailer
                </Link>
              )}
              {film.filmUrl && (
                film.requiresAuth ? (
                  <Link href={`/login?from=/watch/${film.slug}?full=1`} className="detail-btn-secondary">
                    <Lock size={14} /> Watch Full Film
                  </Link>
                ) : (
                  <Link href={`/watch/${film.slug}?full=1`} className="detail-btn-secondary">
                    <Play size={14} fill="currentColor" /> Watch Full Film
                  </Link>
                )
              )}
            </div>

            {film.requiresAuth && (
              <p className="detail-auth-note">
                <Lock size={12} /> Sign in required to watch the full film.{" "}
                <Link href="/register">Create a free account</Link>
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .detail-page { min-height: 100dvh; position: relative; padding-bottom: 6rem; }
        .detail-backdrop {
          position: fixed;
          inset: 0;
          z-index: -1;
        }
        .detail-backdrop-img {
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: 0.12;
        }
        .detail-backdrop-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, var(--color-brand-black) 0%, rgba(10,10,10,0.92) 100%);
        }
        .detail-content { padding-top: 2rem; }
        .detail-back {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-family: var(--font-body);
          font-size: 0.8rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-brand-muted);
          text-decoration: none;
          margin-bottom: 2.5rem;
          transition: color 0.2s;
        }
        .detail-back:hover { color: var(--color-brand-white); }
        .detail-layout {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        @media (min-width: 768px) {
          .detail-layout { flex-direction: row; gap: 3rem; align-items: flex-start; }
        }
        .detail-poster-wrap { flex-shrink: 0; width: 100%; max-width: 280px; }
        @media (min-width: 768px) { .detail-poster-wrap { width: 240px; } }
        .detail-poster {
          width: 100%;
          aspect-ratio: 2/3;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid var(--color-brand-border);
          display: block;
        }
        .detail-poster-placeholder {
          width: 100%;
          aspect-ratio: 2/3;
          background: var(--color-brand-surface);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 5rem;
          font-weight: 900;
          color: var(--color-brand-border);
        }
        .detail-genre {
          font-family: var(--font-body);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-brand-accent);
          display: block;
          margin-bottom: 0.5rem;
        }
        .detail-title {
          font-family: var(--font-display);
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 900;
          color: var(--color-brand-white);
          margin: 0 0 1rem;
          line-height: 1.1;
        }
        .detail-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .detail-meta-item {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-family: var(--font-body);
          font-size: 0.82rem;
          color: var(--color-brand-muted);
        }
        .detail-desc {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--color-brand-light);
          line-height: 1.75;
          margin: 0 0 2rem;
          opacity: 0.85;
          max-width: 520px;
        }
        .detail-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .detail-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-brand-black);
          background: var(--color-brand-accent);
          padding: 0.7rem 1.5rem;
          border-radius: 4px;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .detail-btn-primary:hover { opacity: 0.85; }
        .detail-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--color-brand-white);
          border: 1px solid var(--color-brand-border);
          padding: 0.7rem 1.5rem;
          border-radius: 4px;
          text-decoration: none;
          transition: border-color 0.2s;
        }
        .detail-btn-secondary:hover { border-color: var(--color-brand-white); }
        .detail-auth-note {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-family: var(--font-body);
          font-size: 0.8rem;
          color: var(--color-brand-muted);
          flex-wrap: wrap;
        }
        .detail-auth-note a { color: var(--color-brand-accent); text-decoration: none; }
        .detail-auth-note a:hover { text-decoration: underline; }
      `}</style>
    </main>
  );
}
