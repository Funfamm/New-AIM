import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { Fragment } from "react";
import "./watch.css";
import { ChevronLeft, ChevronRight, Lock, Check } from "lucide-react";
import type { Metadata } from "next";
import EpisodePlayer from "@/components/episode-player";
import VideoPlayer from "@/components/video-player";
import ContentWarningOverlay from "@/components/content-warning-overlay";
import { getWatchProgress, getEpisodeProgressMap } from "@/lib/actions/progress";
import SaveButton from "@/components/save-button";
import LikeButton from "@/components/like-button";
import ShareButton from "@/components/share-button";
import { isWorkSaved } from "@/lib/actions/watchlist";
import { getWorkLikeState } from "@/lib/actions/likes";
import { getOrCreateSession, trackEvent } from "@/lib/analytics";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ full?: string; trailer?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = await prisma.work.findUnique({ where: { slug }, select: { title: true } });
  return { title: work ? `Watch: ${work.title}` : "Watch" };
}

async function getWork(slug: string) {
  return prisma.work.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, status: true, type: true,
      trailerUrl: true, videoUrl: true,
      requiresAuth: true, requiresLoginToViewTrailer: true,
      posterUrl: true, description: true,
      episodeNumber: true, seasonNumber: true, duration: true,
      introStart: true, introEnd: true, creditsStart: true,
      contentRating: true, contentDescriptors: true,
      // SERIES: need episodes for redirect + Up Next titles
      episodes: {
        where: { status: "PUBLISHED" },
        orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
        select: { id: true, slug: true },
        take: 1,
      },
      // EPISODE: parent series controls access, intro timings, and content advisory
      parent: {
        select: {
          id: true, slug: true, title: true, requiresAuth: true,
          introStart: true, introEnd: true, creditsStart: true,
          contentRating: true, contentDescriptors: true,
          episodes: {
            where: { status: "PUBLISHED" },
            orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
            select: {
              id: true, slug: true, title: true,
              episodeNumber: true, seasonNumber: true,
              duration: true, thumbnailUrl: true, posterUrl: true,
            },
          },
        },
      },
      notifyMeCta: {
        select: {
          id: true, type: true, isEnabled: true,
          headline: true, body: true, ctaLabel: true,
          triggerSecondsFromEnd: true,
        },
      },
    },
  });
}

function toEmbedUrl(url: string): string {
  if (url.includes("youtube.com/watch")) {
    const v = new URL(url).searchParams.get("v");
    return `https://www.youtube.com/embed/${v}?rel=0`;
  }
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube.com/embed/${id}?rel=0`;
  }
  if (url.includes("vimeo.com/")) {
    const id = url.split("vimeo.com/")[1].split("?")[0];
    return `https://player.vimeo.com/video/${id}`;
  }
  return url;
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
}

export default async function WatchPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { full, trailer } = await searchParams;
  const work = await getWork(slug);

  const PUBLIC_WATCH_STATUSES = new Set(["PUBLISHED", "UPCOMING", "IN_PRODUCTION"]);
  if (!work || !PUBLIC_WATCH_STATUSES.has(work.status)) notFound();

  // SERIES with episodes → redirect to Episode 1 (smart resume handled on detail page)
  if (work.type === "SERIES" && work.episodes.length > 0 && !trailer) {
    redirect(`/watch/${work.episodes[0].slug}`);
  }

  const session = await auth();
  const isEpisode = work.type === "EPISODE";
  const wantFull  = isEpisode ? true : full === "1";

  // Access control
  const mainRequiresAuth =
    isEpisode ? (work.parent?.requiresAuth ?? false) : work.requiresAuth;
  const trailerRequiresAuth = work.requiresLoginToViewTrailer;
  const isTrailerVisit = work.type === "TRAILER" || (!isEpisode && !wantFull);
  const requiresAuth   = isTrailerVisit ? trailerRequiresAuth : mainRequiresAuth;

  if (requiresAuth && !session?.user) {
    const from = isEpisode ? `/watch/${slug}` : `/watch/${slug}${wantFull ? "?full=1" : ""}`;
    redirect(`/login?from=${from}`);
  }

  // Block full-film viewing for non-published upcoming works
  if (work.status !== "PUBLISHED" && wantFull && !isEpisode) notFound();

  // Video selection
  const videoUrl = isEpisode
    ? work.videoUrl
    : work.type === "TRAILER"
    ? work.videoUrl
    : wantFull && work.videoUrl
    ? work.videoUrl
    : work.trailerUrl;
  const isTrailer = work.type === "TRAILER" || (!isEpisode && (!wantFull || !work.videoUrl));

  const isYouTube = videoUrl?.includes("youtube.com") || videoUrl?.includes("youtu.be");
  const isVimeo   = videoUrl?.includes("vimeo.com");
  const isEmbed   = isYouTube || isVimeo;
  const embedUrl  = videoUrl ? toEmbedUrl(videoUrl) : null;

  // Resume position (0 if completed — player restarts from beginning)
  const initialSeconds = session?.user && !isEmbed && !isTrailer && work.id
    ? await getWatchProgress(work.id)
    : 0;

  const [isSaved, { isLiked, likeCount }] = await Promise.all([
    session?.user ? isWorkSaved(work.id) : Promise.resolve(false),
    getWorkLikeState(work.id),
  ]);

  // Episode nav
  const siblings    = work.parent?.episodes ?? [];
  const currentIdx  = siblings.findIndex((ep) => ep.slug === slug);
  const nextEp      = currentIdx >= 0 && currentIdx < siblings.length - 1
    ? siblings[currentIdx + 1] : null;
  const isLastEp    = isEpisode && siblings.length > 0 && currentIdx === siblings.length - 1;

  // Episode progress map for sidebar (one query for all siblings)
  const siblingProgressMap = session?.user && siblings.length > 0
    ? await getEpisodeProgressMap(siblings.map((e) => e.id))
    : new Map<string, { seconds: number; completed: boolean }>();

  // Notify Me CTA
  let rawCta = work.notifyMeCta?.isEnabled && !isEmbed ? work.notifyMeCta : null;
  if (!rawCta && isLastEp && work.parent?.id) {
    const seriesCta = await prisma.notifyMeCta.findUnique({
      where: { workId: work.parent.id },
      select: { id: true, type: true, isEnabled: true, headline: true, body: true, ctaLabel: true, triggerSecondsFromEnd: true },
    });
    if (seriesCta?.isEnabled) rawCta = seriesCta;
  }

  const ctaAlreadySigned = rawCta && session?.user?.email
    ? await prisma.notifyMeSignup.findFirst({
        where: { ctaId: rawCta.id, email: session.user.email.toLowerCase() },
        select: { id: true },
      })
    : null;

  const ctaProp = rawCta && !ctaAlreadySigned
    ? ({
        id: rawCta.id, type: rawCta.type as string,
        headline: rawCta.headline, body: rawCta.body, ctaLabel: rawCta.ctaLabel,
        triggerSecondsFromEnd: rawCta.triggerSecondsFromEnd,
        workId: work.id, workTitle: work.title,
      } satisfies import("@/components/notify-cta-overlay").CtaData)
    : null;

  const ctaUser = session?.user?.email
    ? { email: session.user.email, name: session.user.name ?? null }
    : undefined;

  // Episodes inherit intro timings + content advisory from parent series
  const introStart      = isEpisode ? (work.parent?.introStart      ?? null) : work.introStart;
  const introEnd        = isEpisode ? (work.parent?.introEnd        ?? null) : work.introEnd;
  const creditsStart    = isEpisode ? (work.parent?.creditsStart    ?? null) : work.creditsStart;
  const contentRating   = isEpisode ? (work.parent?.contentRating   ?? null) : work.contentRating;
  const contentDescriptors = isEpisode
    ? (work.parent?.contentDescriptors ?? [])
    : work.contentDescriptors;

  const hasContentWarning =
    !isEmbed && (!!contentRating || contentDescriptors.length > 0);

  // Analytics
  if (isTrailer) {
    const jar = await cookies();
    const _visitorId = jar.get("aim-vid")?.value;
    const _userId = session?.user?.id ?? undefined;
    const _workId = work.id;
    const _path   = `/watch/${slug}`;
    after(async () => {
      if (!_visitorId) return;
      try {
        const sessionId = await getOrCreateSession({ visitorId: _visitorId }).catch(() => undefined);
        await trackEvent({ visitorId: _visitorId, userId: _userId, sessionId, type: "TRAILER_CLICK", path: _path, workId: _workId });
      } catch {}
    });
  }

  const epLabel =
    isEpisode && (work.seasonNumber != null || work.episodeNumber != null)
      ? [
          work.seasonNumber != null ? `S${work.seasonNumber}` : null,
          work.episodeNumber != null ? `E${work.episodeNumber}` : null,
        ].filter(Boolean).join(" ")
      : null;

  const backHref  = isEpisode && work.parent ? `/works/${work.parent.slug}` : `/works/${work.slug}`;
  const backLabel = isEpisode && work.parent ? work.parent.title : work.title;

  // Group sidebar siblings by season
  const seasonGroups = siblings.reduce<Map<number | null, typeof siblings>>((acc, ep) => {
    const s = ep.seasonNumber;
    if (!acc.has(s)) acc.set(s, []);
    acc.get(s)!.push(ep);
    return acc;
  }, new Map());
  const hasMultipleSeasons = seasonGroups.size > 1;

  return (
    <main className="watch-page">
      <div className="container-app">
        <Link href={backHref} className="watch-back">
          <ChevronLeft size={16} /> {backLabel}
        </Link>

        <p className="watch-label">
          {isEpisode ? (epLabel ?? "Episode") : isTrailer ? "Trailer" : "Full Film"}
        </p>

        <div className="watch-layout">
          {/* ── Main column ── */}
          <div className="watch-main">

            {/* Content warning overlay — uses parent series values for episodes */}
            {hasContentWarning && (
              <ContentWarningOverlay
                workId={isEpisode && work.parent ? work.parent.id : work.id}
                contentRating={contentRating}
                contentDescriptors={contentDescriptors}
                onDismiss={() => {}}
              />
            )}

            <div className="watch-player-wrap">
              {videoUrl ? (
                isEmbed ? (
                  <iframe
                    src={embedUrl!}
                    className="watch-iframe"
                    allow="fullscreen; picture-in-picture"
                    allowFullScreen
                    title={work.title}
                  />
                ) : isEpisode ? (
                  <EpisodePlayer
                    src={videoUrl}
                    poster={work.posterUrl ?? undefined}
                    nextSlug={nextEp?.slug}
                    nextTitle={nextEp?.title}
                    workId={work.id}
                    initialSeconds={initialSeconds}
                    durationMinutes={work.duration ?? undefined}
                    cta={ctaProp}
                    ctaUser={ctaUser}
                    introStart={introStart}
                    introEnd={introEnd}
                    creditsStart={creditsStart}
                  />
                ) : (
                  <VideoPlayer
                    src={videoUrl}
                    poster={work.posterUrl ?? undefined}
                    workId={work.id}
                    initialSeconds={initialSeconds}
                    durationMinutes={work.duration ?? undefined}
                    cta={ctaProp}
                    ctaUser={ctaUser}
                    introStart={introStart}
                    introEnd={introEnd}
                    creditsStart={creditsStart}
                  />
                )
              ) : (
                <div className="watch-no-video">
                  <p>This video is unavailable right now. Please try again later.</p>
                </div>
              )}
            </div>

            <div className="watch-info">
              <h1 className="watch-title">{work.title}</h1>
              {work.description && <p className="watch-desc">{work.description}</p>}

              <div className="watch-engagement">
                {session?.user && (
                  <SaveButton workId={work.id} initialSaved={isSaved} className="save-btn save-btn--sm" />
                )}
                <LikeButton
                  workId={work.id} initialLiked={isLiked} likeCount={likeCount}
                  isGuest={!session?.user}
                  slug={isEpisode && work.parent ? work.parent.slug : work.slug}
                  size="sm"
                />
                <ShareButton
                  title={isEpisode && work.parent ? work.parent.title : work.title}
                  slug={isEpisode && work.parent ? work.parent.slug : work.slug}
                  workId={isEpisode && work.parent ? work.parent.id : work.id}
                  size="sm"
                />
              </div>

              {/* Next Episode button (below player on mobile) */}
              {isEpisode && nextEp && (
                <Link href={`/watch/${nextEp.slug}`} className="watch-next-ep">
                  Next Episode <ChevronRight size={15} />
                </Link>
              )}

              {/* Trailer → Full Film upsell */}
              {isTrailer && work.type !== "TRAILER" && work.videoUrl && (
                <div className="watch-upsell">
                  {mainRequiresAuth && !session?.user ? (
                    <>
                      <Lock size={14} />
                      <span>
                        <Link href="/register">Create a free account</Link> to watch the full film.
                      </span>
                    </>
                  ) : (
                    <Link href={`/watch/${work.slug}?full=1`} className="watch-upsell-btn">
                      Watch Full Film →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Episode sidebar ── */}
          {isEpisode && siblings.length > 1 && (
            <aside className="watch-ep-sidebar">
              <p className="watch-ep-sidebar-label">Episodes</p>
              <ol className="watch-ep-list">
                {Array.from(seasonGroups.entries()).map(([season, eps]) => (
                  <Fragment key={season ?? "no-season"}>
                    {hasMultipleSeasons && (
                      <li className="watch-season-head" aria-hidden="true">
                        {season != null ? `Season ${season}` : "Episodes"}
                      </li>
                    )}
                    {eps.map((ep) => {
                      const isCurrent = ep.slug === slug;
                      const prog = siblingProgressMap.get(ep.id);
                      const pct = prog && ep.duration
                        ? Math.min(100, Math.round((prog.seconds / (ep.duration * 60)) * 100))
                        : 0;
                      const isWatched = prog?.completed ?? false;
                      const num = [
                        ep.seasonNumber != null ? `S${ep.seasonNumber}` : null,
                        ep.episodeNumber != null ? `E${ep.episodeNumber}` : null,
                      ].filter(Boolean).join(" ");
                      const dur = ep.duration ? fmtDur(ep.duration) : null;
                      const thumb = ep.thumbnailUrl ?? ep.posterUrl ?? null;

                      return (
                        <li
                          key={ep.id}
                          className={`watch-ep-item${isCurrent ? " watch-ep-item--current" : ""}`}
                        >
                          {isCurrent ? (
                            <div className="watch-ep-link watch-ep-link--static">
                              {thumb && (
                                <div className="watch-ep-thumb" aria-hidden="true">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={thumb} alt="" loading="lazy" />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="watch-ep-meta">
                                  {num && <span className="watch-ep-num">{num}</span>}
                                  {dur && <span className="watch-ep-dur">{dur}</span>}
                                </div>
                                <span className="watch-ep-title">{ep.title}</span>
                                <span className="watch-ep-now">Now Playing</span>
                                {pct > 0 && !isWatched && (
                                  <div className="watch-ep-progress-bar">
                                    <div className="watch-ep-progress-fill" style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <Link href={`/watch/${ep.slug}`} className="watch-ep-link">
                              {thumb && (
                                <div className="watch-ep-thumb" aria-hidden="true">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={thumb} alt="" loading="lazy" />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="watch-ep-meta">
                                  {num && <span className="watch-ep-num">{num}</span>}
                                  {dur && <span className="watch-ep-dur">{dur}</span>}
                                </div>
                                <span className="watch-ep-title">{ep.title}</span>
                                {isWatched && (
                                  <div className="watch-ep-watched">
                                    <Check size={9} style={{ display: "inline", marginRight: 2 }} />
                                    Watched
                                  </div>
                                )}
                                {!isWatched && pct > 0 && (
                                  <div className="watch-ep-progress-bar">
                                    <div className="watch-ep-progress-fill" style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </Fragment>
                ))}
              </ol>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
