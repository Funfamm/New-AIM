import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import "./detail.css";
import Image from "next/image";
import { Play, Clock, Calendar, ChevronLeft, Lock } from "lucide-react";
import type { Metadata } from "next";
import SynopsisToggle from "@/components/synopsis-toggle";
import SaveButton from "@/components/save-button";
import { isWorkSaved } from "@/lib/actions/watchlist";

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
  const isSaved = !isGuest ? await isWorkSaved(work.id) : false;
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
                  fill
                  className="detail-poster"
                  priority
                  quality={90}
                  sizes="(max-width: 767px) 260px, (max-width: 1023px) 220px, 260px"
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

              {/* Save to watchlist — logged-in users only */}
              {!isGuest && (
                <SaveButton workId={work.id} initialSaved={isSaved} />
              )}

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

    </main>
  );
}
