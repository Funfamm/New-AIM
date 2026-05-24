import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Play, Clock, Calendar, ChevronLeft, Lock } from "lucide-react";
import type { Metadata } from "next";
import SynopsisToggle from "@/components/synopsis-toggle";

type Props = { params: Promise<{ slug: string }> };

const TYPE_LABEL: Record<string, string> = {
  SHORT_FILM: "Short Film",
  FULL_FILM: "Film",
  SERIES: "Series",
  TRAILER: "Trailer",
  COMMERCIAL: "Commercial",
  BRANDING: "Branding",
  CAMPAIGN: "Campaign",
  CASE_STUDY: "Case Study",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = await prisma.work.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });
  if (!work) return { title: "Not Found" };
  return { title: work.title, description: work.description ?? undefined };
}

async function getWork(slug: string) {
  return prisma.work.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, type: true, status: true,
      description: true, posterUrl: true, trailerUrl: true, videoUrl: true,
      year: true, duration: true, genre: true, director: true,
      requiresAuth: true,
      episodes: {
        where: { status: "PUBLISHED" },
        orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
        select: {
          id: true, slug: true, title: true,
          description: true, posterUrl: true, videoUrl: true,
          duration: true, seasonNumber: true, episodeNumber: true,
          requiresAuth: true,
        },
      },
    },
  });
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function WorkDetailPage({ params }: Props) {
  const { slug } = await params;
  const [work, session] = await Promise.all([getWork(slug), auth()]);

  if (!work || work.status !== "PUBLISHED") notFound();

  const isGuest = !session?.user;
  const locked = work.requiresAuth && isGuest;
  const firstEp = work.type === "SERIES" ? work.episodes[0] ?? null : null;
  const episodeCount = work.type === "SERIES" ? work.episodes.length : null;

  // Determine if there is a watchable main feature (series ep1 or full film)
  const hasMainContent = (work.type === "SERIES" && firstEp != null) ||
    (work.type !== "SERIES" && !!work.videoUrl);

  return (
    <main className="detail-page">

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="detail-hero">

        {/* Ambient backdrop — blurred, faint, scoped to section only */}
        {work.posterUrl && (
          <div className="detail-backdrop" aria-hidden="true">
            <img src={work.posterUrl} alt="" className="detail-backdrop-img" />
            <div className="detail-backdrop-gradient" />
          </div>
        )}

        <div className="container-app detail-hero-inner">
          <Link href="/works" className="detail-back">
            <ChevronLeft size={15} /> All Works
          </Link>

          <div className="detail-layout">

            {/* Poster */}
            <div className="detail-poster-wrap">
              {work.posterUrl ? (
                <Image
                  src={work.posterUrl}
                  alt={work.title}
                  width={480}
                  height={720}
                  className="detail-poster"
                  priority
                  sizes="(max-width: 640px) 280px, (max-width: 1024px) 220px, 260px"
                />
              ) : (
                <div className="detail-poster-placeholder">
                  <span>{work.title.charAt(0)}</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="detail-info">

              {/* Genre eyebrow */}
              {work.genre && (
                <span className="detail-genre">{work.genre}</span>
              )}

              <h1 className="detail-title">{work.title}</h1>

              {/* Metadata row */}
              <div className="detail-meta">
                {work.type && TYPE_LABEL[work.type] && (
                  <span className="detail-meta-chip">{TYPE_LABEL[work.type]}</span>
                )}
                {work.year && (
                  <span className="detail-meta-item">
                    <Calendar size={12} />{work.year}
                  </span>
                )}
                {work.duration && (
                  <span className="detail-meta-item">
                    <Clock size={12} />{fmtDuration(work.duration)}
                  </span>
                )}
                {episodeCount != null && episodeCount > 0 && (
                  <span className="detail-meta-item">
                    {episodeCount} {episodeCount === 1 ? "Episode" : "Episodes"}
                  </span>
                )}
                {work.director && (
                  <span className="detail-meta-item">Dir. {work.director}</span>
                )}
              </div>

              {/* Synopsis — 2-line clamp with More/Less */}
              {work.description && <SynopsisToggle text={work.description} />}

              {/* CTAs */}
              <div className="detail-actions">
                {/* Trailer button — ghost unless it's the only content */}
                {work.trailerUrl && (
                  <Link
                    href={`/watch/${work.slug}`}
                    className={hasMainContent ? "detail-btn-ghost" : "detail-btn-primary"}
                  >
                    <Play size={14} fill="currentColor" /> Watch Trailer
                  </Link>
                )}

                {/* SERIES → episode 1 */}
                {work.type === "SERIES" && firstEp && (
                  locked ? (
                    <Link
                      href={`/login?from=/watch/${firstEp.slug}`}
                      className="detail-btn-primary"
                    >
                      <Lock size={14} /> Sign In to Watch
                    </Link>
                  ) : (
                    <Link
                      href={`/watch/${firstEp.slug}`}
                      className="detail-btn-primary"
                    >
                      <Play size={14} fill="currentColor" /> Watch Series
                    </Link>
                  )
                )}

                {/* Film / short / other → full video */}
                {work.type !== "SERIES" && work.videoUrl && (
                  locked ? (
                    <Link
                      href={`/login?from=/watch/${work.slug}?full=1`}
                      className="detail-btn-primary"
                    >
                      <Lock size={14} /> Sign In to Watch
                    </Link>
                  ) : (
                    <Link
                      href={`/watch/${work.slug}?full=1`}
                      className="detail-btn-primary"
                    >
                      <Play size={14} fill="currentColor" /> Watch Full Film
                    </Link>
                  )
                )}
              </div>

              {/* Guest note — only shown when content is gated */}
              {work.requiresAuth && isGuest && (
                <p className="detail-auth-note">
                  <Lock size={11} /> Members only.{" "}
                  <Link href="/register">Create a free account</Link> to watch.
                </p>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* ── Episodes ──────────────────────────────────── */}
      {work.type === "SERIES" && (
        <section className="episodes-section">
          <div className="container-app">

            <div className="episodes-head">
              <h2 className="episodes-title">Episodes</h2>
              {episodeCount != null && episodeCount > 0 && (
                <span className="episodes-count">
                  {episodeCount} {episodeCount === 1 ? "Episode" : "Episodes"}
                </span>
              )}
            </div>

            {work.episodes.length === 0 ? (
              <p className="episodes-empty">Episodes are coming soon.</p>
            ) : (
              <ol className="episodes-list">
                {work.episodes.map((ep) => {
                  const label =
                    ep.seasonNumber != null && ep.episodeNumber != null
                      ? `S${ep.seasonNumber} E${ep.episodeNumber}`
                      : ep.episodeNumber != null
                      ? `E${ep.episodeNumber}`
                      : null;

                  const epLocked = (ep.requiresAuth || work.requiresAuth) && isGuest;

                  return (
                    <li key={ep.id}>
                      <div className="ep-card">

                        {/* Thumbnail */}
                        <div className="ep-thumb-wrap">
                          {ep.posterUrl ? (
                            <Image
                              src={ep.posterUrl}
                              alt={ep.title}
                              fill
                              sizes="(max-width: 640px) 100px, 160px"
                              className="ep-thumb-img"
                              quality={75}
                            />
                          ) : (
                            <div className="ep-thumb-placeholder">
                              {label ?? ep.title.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="ep-body">
                          <div className="ep-meta-row">
                            {label && <span className="ep-label">{label}</span>}
                            {ep.duration && (
                              <span className="ep-duration">
                                <Clock size={10} />
                                {fmtDuration(ep.duration)}
                              </span>
                            )}
                          </div>
                          <p className="ep-title">{ep.title}</p>
                          {ep.description && (
                            <p className="ep-desc">{ep.description}</p>
                          )}
                        </div>

                        {/* Watch action */}
                        <div className="ep-watch">
                          {ep.videoUrl ? (
                            epLocked ? (
                              <Link
                                href={`/login?from=/watch/${ep.slug}`}
                                className="ep-btn ep-btn--locked"
                              >
                                <Lock size={11} /> Watch
                              </Link>
                            ) : (
                              <Link
                                href={`/watch/${ep.slug}`}
                                className="ep-btn"
                              >
                                <Play size={11} fill="currentColor" /> Watch
                              </Link>
                            )
                          ) : (
                            <span className="ep-soon">Soon</span>
                          )}
                        </div>

                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

          </div>
        </section>
      )}

      <style>{`
        .detail-page {
          min-height: 100dvh;
          padding-bottom: 6rem;
        }

        /* ── Hero backdrop — scoped, not full-page-fixed ── */
        .detail-hero {
          position: relative;
          overflow: hidden;
          padding-bottom: 3.5rem;
        }
        .detail-backdrop {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
        }
        .detail-backdrop-img {
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: 0.09;
          filter: blur(56px);
          transform: scale(1.08);
        }
        .detail-backdrop-gradient {
          position: absolute; inset: 0;
          background:
            linear-gradient(to bottom, rgba(10,10,10,0.25) 0%, var(--color-brand-black) 72%),
            linear-gradient(to right, var(--color-brand-black) 0%, rgba(10,10,10,0) 55%);
        }
        .detail-hero-inner {
          position: relative; z-index: 1;
          padding-top: 2rem;
        }

        /* ── Back link ── */
        .detail-back {
          display: inline-flex; align-items: center; gap: 0.25rem;
          font-family: var(--font-body); font-size: 0.75rem; font-weight: 500;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-brand-muted); text-decoration: none;
          margin-bottom: 2rem; transition: color 0.15s;
        }
        .detail-back:hover { color: var(--color-brand-white); }

        /* ── Two-column layout ── */
        .detail-layout {
          display: flex; flex-direction: column; gap: 2rem;
        }
        @media (min-width: 768px) {
          .detail-layout { flex-direction: row; gap: 3rem; align-items: flex-start; }
        }

        /* ── Poster ── */
        .detail-poster-wrap {
          flex-shrink: 0; width: 100%; max-width: 260px;
        }
        @media (min-width: 768px) { .detail-poster-wrap { width: 220px; } }
        @media (min-width: 1024px) { .detail-poster-wrap { width: 260px; } }
        .detail-poster {
          width: 100%; height: auto; aspect-ratio: 2/3;
          object-fit: cover; border-radius: 4px;
          border: 1px solid var(--color-brand-border);
          display: block;
        }
        .detail-poster-placeholder {
          width: 100%; aspect-ratio: 2/3;
          background: var(--color-brand-surface); border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 5rem; font-weight: 700;
          color: var(--color-brand-border);
        }

        /* ── Info panel ── */
        .detail-info { flex: 1; min-width: 0; }
        .detail-genre {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--color-brand-accent); display: block; margin-bottom: 0.5rem;
        }
        .detail-title {
          font-family: var(--font-display);
          font-size: clamp(2rem, 5vw, 3.25rem);
          font-weight: 700; letter-spacing: -0.02em; line-height: 1.1;
          color: var(--color-brand-white); margin: 0 0 1rem;
        }

        /* ── Metadata ── */
        .detail-meta {
          display: flex; flex-wrap: wrap; align-items: center;
          gap: 0.5rem 0.875rem; margin-bottom: 1.5rem;
        }
        .detail-meta-chip {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.07em; text-transform: uppercase;
          color: var(--color-brand-white);
          background: var(--color-brand-surface);
          border: 1px solid var(--color-brand-border);
          padding: 0.2rem 0.5rem; border-radius: 2px;
        }
        .detail-meta-item {
          display: flex; align-items: center; gap: 0.3rem;
          font-family: var(--font-body); font-size: 0.8125rem;
          color: var(--color-brand-muted);
        }

        /* ── CTAs ── */
        .detail-actions {
          display: flex; gap: 0.75rem; flex-wrap: wrap;
          margin-top: 0.25rem; margin-bottom: 1rem;
        }
        .detail-btn-primary {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--color-brand-black); background: var(--color-brand-accent);
          height: 52px; padding: 0 1.75rem; border-radius: 2px; text-decoration: none;
          transition: filter 0.2s, transform 0.2s; touch-action: manipulation;
        }
        .detail-btn-primary:hover {
          filter: brightness(1.06); transform: translateY(-1px);
        }
        .detail-btn-ghost {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 500;
          color: var(--color-brand-white);
          border: 1px solid rgba(255,255,255,0.28);
          height: 52px; padding: 0 1.75rem; border-radius: 2px; text-decoration: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .detail-btn-ghost:hover {
          border-color: rgba(255,255,255,0.65);
          background: rgba(255,255,255,0.05);
        }
        .detail-auth-note {
          display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;
          font-family: var(--font-body); font-size: 0.8rem;
          color: var(--color-brand-muted);
        }
        .detail-auth-note a { color: var(--color-brand-accent); text-decoration: none; }
        .detail-auth-note a:hover { text-decoration: underline; }

        /* ══ Episodes ══════════════════════════════════ */
        .episodes-section { padding-top: 2.5rem; padding-bottom: 6rem; }
        .episodes-head {
          display: flex; align-items: baseline;
          justify-content: space-between; margin-bottom: 1.25rem;
        }
        .episodes-title {
          font-family: var(--font-display);
          font-size: clamp(1.25rem, 2.5vw, 1.5rem);
          font-weight: 700; letter-spacing: -0.01em;
          color: var(--color-brand-white); margin: 0;
        }
        .episodes-count {
          font-family: var(--font-body); font-size: 0.75rem; font-weight: 500;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-brand-muted);
        }
        .episodes-empty {
          font-family: var(--font-body); font-size: 0.95rem;
          color: var(--color-brand-muted); padding: 2rem 0;
        }
        .episodes-list {
          list-style: none; margin: 0; padding: 0;
          display: flex; flex-direction: column; gap: 0.625rem;
        }

        /* ── Episode card ── */
        .ep-card {
          display: grid;
          grid-template-columns: 100px 1fr;
          grid-template-rows: auto auto;
          column-gap: 1rem;
          row-gap: 0.625rem;
          background: var(--color-brand-dark);
          border: 1px solid var(--color-brand-border);
          border-radius: 4px;
          padding: 0.875rem 1rem;
          transition: background 0.15s, border-color 0.15s;
        }
        .ep-card:hover {
          background: var(--color-brand-surface);
          border-color: rgba(255,255,255,0.09);
        }
        @media (min-width: 640px) {
          .ep-card {
            grid-template-columns: 160px 1fr auto;
            grid-template-rows: 1fr;
            align-items: center;
          }
        }

        /* Thumbnail — spans both rows on mobile */
        .ep-thumb-wrap {
          position: relative;
          grid-column: 1; grid-row: 1 / 3;
          aspect-ratio: 16/9;
          background: var(--color-brand-surface);
          border-radius: 3px; overflow: hidden;
          align-self: start;
        }
        @media (min-width: 640px) {
          .ep-thumb-wrap { grid-column: 1; grid-row: 1; align-self: center; }
        }
        .ep-thumb-img { object-fit: cover; }
        .ep-thumb-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-body); font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--color-brand-muted);
        }

        /* Info */
        .ep-body { grid-column: 2; grid-row: 1; min-width: 0; }
        .ep-meta-row {
          display: flex; align-items: center; gap: 0.625rem; margin-bottom: 0.25rem;
        }
        .ep-label {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--color-brand-accent);
        }
        .ep-duration {
          display: flex; align-items: center; gap: 0.2rem;
          font-family: var(--font-body); font-size: 0.6875rem;
          color: var(--color-brand-muted);
        }
        .ep-title {
          font-family: var(--font-body); font-size: 0.9375rem; font-weight: 600;
          color: var(--color-brand-white); margin: 0 0 0.3rem; line-height: 1.35;
        }
        .ep-desc {
          font-family: var(--font-body); font-size: 0.8125rem;
          color: var(--color-brand-muted); line-height: 1.55; margin: 0;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }

        /* Watch button */
        .ep-watch {
          grid-column: 2; grid-row: 2;
          display: flex; align-items: center;
        }
        @media (min-width: 640px) {
          .ep-watch { grid-column: 3; grid-row: 1; }
        }
        .ep-btn {
          display: inline-flex; align-items: center; gap: 0.3rem;
          font-family: var(--font-body); font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--color-brand-black); background: var(--color-brand-accent);
          height: 34px; padding: 0 0.875rem; border-radius: 2px;
          text-decoration: none; white-space: nowrap;
          transition: filter 0.15s;
        }
        .ep-btn:hover { filter: brightness(1.08); }
        .ep-btn--locked {
          background: transparent; color: var(--color-brand-white);
          border: 1px solid rgba(255,255,255,0.22);
        }
        .ep-btn--locked:hover {
          border-color: rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.04);
          filter: none;
        }
        .ep-soon {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 500;
          color: var(--color-brand-muted); letter-spacing: 0.06em; text-transform: uppercase;
        }
      `}</style>
    </main>
  );
}
