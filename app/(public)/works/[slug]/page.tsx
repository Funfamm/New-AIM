import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import Link from "next/link";
import "./detail.css";
import Image from "next/image";
import { Play, Clock, Calendar, ChevronLeft, Lock } from "lucide-react";
import type { Metadata } from "next";
import SynopsisToggle from "@/components/synopsis-toggle";
import SaveButton from "@/components/save-button";
import LikeButton from "@/components/like-button";
import ShareButton from "@/components/share-button";
import { isWorkSaved } from "@/lib/actions/watchlist";
import { getWorkLikeState } from "@/lib/actions/likes";
import { getOrCreateSession, trackEvent } from "@/lib/analytics";
import SeriesTrailerPlayer from "@/components/series-trailer-player";

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

const STATUS_BADGE: Record<string, { label: string; cls: string } | undefined> = {
  UPCOMING:      { label: "Coming Soon",    cls: "detail-status-badge detail-status-badge--upcoming" },
  IN_PRODUCTION: { label: "In Production",  cls: "detail-status-badge detail-status-badge--production" },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = await prisma.work.findUnique({
    where: { slug },
    select: { title: true, description: true, posterUrl: true },
  });
  if (!work) return { title: "Not Found" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aimstudio.app";
  const ogImage = work.posterUrl
    ? { url: work.posterUrl, width: 1200, height: 630, alt: work.title }
    : { url: `${appUrl}/images/SP_Logo.jpg`, width: 1200, height: 630, alt: "AIM Studio" };

  return {
    title: work.title,
    description: work.description ?? undefined,
    alternates: { canonical: `${appUrl}/works/${slug}` },
    openGraph: {
      title: work.title,
      description: work.description ?? undefined,
      url: `${appUrl}/works/${slug}`,
      images: [ogImage],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: work.title,
      description: work.description ?? undefined,
      images: [work.posterUrl ?? `${appUrl}/images/SP_Logo.jpg`],
    },
  };
}

async function getWork(slug: string) {
  return prisma.work.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, type: true, status: true,
      description: true, posterUrl: true, trailerUrl: true, videoUrl: true,
      year: true, duration: true, genre: true, director: true,
      requiresAuth: true, requiresLoginToViewTrailer: true,
      episodes: {
        where: { status: "PUBLISHED" },
        orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
        select: {
          id: true, slug: true, title: true,
          description: true, posterUrl: true, videoUrl: true,
          duration: true, seasonNumber: true, episodeNumber: true,
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

  const PUBLIC_STATUSES = new Set(["PUBLISHED", "UPCOMING", "IN_PRODUCTION"]);
  if (!work || !PUBLIC_STATUSES.has(work.status)) notFound();

  // Track WORK_VIEW after the response is sent — zero render latency
  const jar = await cookies();
  const _visitorId = jar.get("aim-vid")?.value;
  const _userId    = session?.user?.id ?? undefined;
  const _workId    = work.id;
  const _path      = `/works/${slug}`;
  after(async () => {
    if (!_visitorId) return;
    try {
      const sessionId = await getOrCreateSession({ visitorId: _visitorId, landingPage: _path })
        .catch(() => undefined);
      await trackEvent({
        visitorId: _visitorId,
        userId: _userId,
        sessionId,
        type: "WORK_VIEW",
        path: _path,
        workId: _workId,
      });
    } catch { /* analytics must never break the page */ }
  });

  const isGuest       = !session?.user;
  const locked        = work.requiresAuth && isGuest;
  const trailerLocked = work.requiresLoginToViewTrailer && isGuest;
  const isPublished   = work.status === "PUBLISHED";

  const [isSaved, { isLiked, likeCount }] = await Promise.all([
    !isGuest ? isWorkSaved(work.id) : Promise.resolve(false),
    getWorkLikeState(work.id),
  ]);

  const firstEp      = work.type === "SERIES" ? work.episodes[0] ?? null : null;
  const episodeCount = work.type === "SERIES" ? work.episodes.length : null;
  const isSeries     = work.type === "SERIES";

  const hasMainContent =
    (isSeries && firstEp != null) ||
    (!isSeries && work.type !== "TRAILER" && !!work.videoUrl);

  // Trailer href — series needs ?trailer=1 to bypass the series→ep1 redirect on watch page
  const trailerHref = isSeries
    ? `/watch/${work.slug}?trailer=1`
    : `/watch/${work.slug}`;
  const trailerLoginHref = isSeries
    ? `/login?from=/watch/${work.slug}?trailer=1`
    : `/login?from=/watch/${work.slug}`;

  return (
    <main className="detail-page">

      {/* ── Mobile sticky 16:9 player (series only) ──────────────
          Hidden on desktop via CSS. Shows poster; plays trailer inline on tap.
          Renders before the hero so it sticks under the fixed nav (top: 68px).  */}
      {isSeries && (
        <SeriesTrailerPlayer
          posterUrl={work.posterUrl}
          trailerUrl={work.trailerUrl}
          title={work.title}
        />
      )}

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="detail-hero">

        {/* Ambient backdrop */}
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

            {/* Portrait poster — hidden on mobile for series (replaced by sticky player) */}
            <div className={`detail-poster-wrap${isSeries ? " detail-poster-wrap--mobile-hide" : ""}`}>
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

              {work.genre && (
                <span className="detail-genre">{work.genre}</span>
              )}

              <h1 className="detail-title">{work.title}</h1>

              {/* Metadata */}
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

              {work.description && <SynopsisToggle text={work.description} />}

              {/* Status badge — upcoming / in-production works */}
              {STATUS_BADGE[work.status] && (
                <span className={STATUS_BADGE[work.status]!.cls}>
                  {STATUS_BADGE[work.status]!.label}
                </span>
              )}

              {/* CTAs */}
              <div className="detail-actions">

                {/* Watch Trailer — ghost when full content also exists; primary when no full content */}
                {work.trailerUrl && (
                  <div className={isSeries ? "detail-trailer-desktop-only" : undefined}>
                    {trailerLocked ? (
                      <Link
                        href={trailerLoginHref}
                        className={hasMainContent && isPublished ? "detail-btn-ghost" : "detail-btn-primary"}
                      >
                        <Lock size={14} /> Sign In to Watch Trailer
                      </Link>
                    ) : (
                      <Link
                        href={trailerHref}
                        className={hasMainContent && isPublished ? "detail-btn-ghost" : "detail-btn-primary"}
                      >
                        <Play size={14} fill="currentColor" /> Watch Trailer
                      </Link>
                    )}
                  </div>
                )}

                {/* SERIES → Watch Series (ep 1) — published + has episodes only */}
                {isSeries && firstEp && isPublished && (
                  locked ? (
                    <Link href={`/login?from=/watch/${firstEp.slug}`} className="detail-btn-primary">
                      <Lock size={14} /> Sign In to Watch
                    </Link>
                  ) : (
                    <Link href={`/watch/${firstEp.slug}`} className="detail-btn-primary">
                      <Play size={14} fill="currentColor" /> Watch Series
                    </Link>
                  )
                )}

                {/* Film / short / other → full video — published only; TRAILER type excluded */}
                {!isSeries && work.type !== "TRAILER" && work.videoUrl && isPublished && (
                  locked ? (
                    <Link href={`/login?from=/watch/${work.slug}?full=1`} className="detail-btn-primary">
                      <Lock size={14} /> Sign In to Watch
                    </Link>
                  ) : (
                    <Link href={`/watch/${work.slug}?full=1`} className="detail-btn-primary">
                      <Play size={14} fill="currentColor" /> Watch Full Film
                    </Link>
                  )
                )}
              </div>

              {/* Engagement row — Save (members) + Like + Share */}
              <div className="detail-engagement">
                {!isGuest && (
                  <SaveButton workId={work.id} initialSaved={isSaved} />
                )}
                <LikeButton
                  workId={work.id}
                  initialLiked={isLiked}
                  likeCount={likeCount}
                  isGuest={isGuest}
                  slug={work.slug}
                />
                <ShareButton title={work.title} slug={work.slug} workId={work.id} />
              </div>

              {/* Guest note — only when content is gated */}
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

      {/* ── Episodes (series only) ─────────────────────── */}
      {isSeries && (
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

                  // Episode access inherits from parent Series — no separate lock per episode
                  const epLocked = work.requiresAuth && isGuest;

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
                              loading="lazy"
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
                              <Link href={`/watch/${ep.slug}`} className="ep-btn">
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
