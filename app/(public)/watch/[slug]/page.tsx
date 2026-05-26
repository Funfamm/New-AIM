import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import Link from "next/link";
import "./watch.css";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import type { Metadata } from "next";
import EpisodePlayer from "@/components/episode-player";
import VideoPlayer from "@/components/video-player";
import { getWatchProgress } from "@/lib/actions/progress";
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
      // SERIES: need first episode slug for redirect
      episodes: {
        where: { status: "PUBLISHED" },
        orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
        select: { id: true, slug: true },
        take: 1,
      },
      // EPISODE: need parent series info and all sibling episodes
      parent: {
        select: {
          id: true, slug: true, title: true, requiresAuth: true,
          episodes: {
            where: { status: "PUBLISHED" },
            orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
            select: {
              id: true, slug: true, title: true,
              episodeNumber: true, seasonNumber: true,
              duration: true,
            },
          },
        },
      },
      // Notify Me CTA — only enabled ones matter on the public side
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

export default async function WatchPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { full, trailer } = await searchParams;
  const work = await getWork(slug);

  const PUBLIC_WATCH_STATUSES = new Set(["PUBLISHED", "UPCOMING", "IN_PRODUCTION"]);
  if (!work || !PUBLIC_WATCH_STATUSES.has(work.status)) notFound();

  // SERIES with episodes → redirect to episode 1
  // Skip redirect when ?trailer=1 so the series trailer can play on the watch page
  if (work.type === "SERIES" && work.episodes.length > 0 && !trailer) {
    redirect(`/watch/${work.episodes[0].slug}`);
  }

  const session = await auth();
  const isEpisode = work.type === "EPISODE";
  const wantFull  = isEpisode ? true : full === "1";

  // ── Access control ────────────────────────────────────────────
  // Episodes: inherit requiresAuth from parent Series (episodes never carry their own lock)
  const mainRequiresAuth =
    isEpisode
      ? (work.parent?.requiresAuth ?? false)
      : work.requiresAuth;

  // Trailers: governed by requiresLoginToViewTrailer, independent of main content lock
  const trailerRequiresAuth = work.requiresLoginToViewTrailer;

  // Determine which guard applies to this visit
  // TRAILER-type works are always trailers regardless of URL params
  const isTrailerVisit = work.type === "TRAILER" || (!isEpisode && !wantFull);
  const requiresAuth   = isTrailerVisit ? trailerRequiresAuth : mainRequiresAuth;

  if (requiresAuth && !session?.user) {
    const from = isEpisode ? `/watch/${slug}` : `/watch/${slug}${wantFull ? "?full=1" : ""}`;
    redirect(`/login?from=${from}`);
  }

  // Video selection
  // TRAILER-type works store the clip in videoUrl (there is no separate trailerUrl)
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

  // Trailers always restart from the beginning — never resume
  // Block full-film viewing for non-published works (upcoming/in-production can only show trailers)
  if (work.status !== "PUBLISHED" && wantFull) notFound();

  const initialSeconds = session?.user && !isEmbed && !isTrailer && work.id
    ? await getWatchProgress(work.id)
    : 0;

  const [isSaved, { isLiked, likeCount }] = await Promise.all([
    session?.user ? isWorkSaved(work.id) : Promise.resolve(false),
    getWorkLikeState(work.id),
  ]);

  // ── Episode navigation (computed before CTA so we can detect last episode) ──
  const siblings = work.parent?.episodes ?? [];
  const currentIdx = siblings.findIndex((ep) => ep.slug === slug);
  const nextEp = currentIdx >= 0 && currentIdx < siblings.length - 1
    ? siblings[currentIdx + 1]
    : null;
  const isLastEpisode = isEpisode && siblings.length > 0 && currentIdx === siblings.length - 1;

  // ── Notify Me CTA ─────────────────────────────────────────────────────────
  // Shown on native video (not embeds). Trailers now also eligible (guest use case).
  // For last episode of a series: fall back to the parent series CTA.
  let rawCta = work.notifyMeCta?.isEnabled && !isEmbed ? work.notifyMeCta : null;

  if (!rawCta && isLastEpisode && work.parent?.id) {
    // Fetch series CTA — only runs on the last episode, one extra query
    const seriesCta = await prisma.notifyMeCta.findUnique({
      where: { workId: work.parent.id },
      select: {
        id: true, type: true, isEnabled: true,
        headline: true, body: true, ctaLabel: true,
        triggerSecondsFromEnd: true,
      },
    });
    if (seriesCta?.isEnabled) rawCta = seriesCta;
  }

  const ctaAlreadySigned =
    rawCta && session?.user?.email
      ? await prisma.notifyMeSignup.findFirst({
          where: { ctaId: rawCta.id, email: session.user.email.toLowerCase() },
          select: { id: true },
        })
      : null;

  const ctaProp = rawCta && !ctaAlreadySigned
    ? ({
        id:                    rawCta.id,
        type:                  rawCta.type as string,
        headline:              rawCta.headline,
        body:                  rawCta.body,
        ctaLabel:              rawCta.ctaLabel,
        triggerSecondsFromEnd: rawCta.triggerSecondsFromEnd,
        workId:                work.id,
        workTitle:             work.title,
      } satisfies import("@/components/notify-cta-overlay").CtaData)
    : null;

  const ctaUser = session?.user?.email
    ? { email: session.user.email, name: session.user.name ?? null }
    : undefined;

  // Track TRAILER_CLICK after response — fires when the watch page loads in trailer mode
  if (isTrailer) {
    const jar = await cookies();
    const _visitorId = jar.get("aim-vid")?.value;
    const _userId    = session?.user?.id ?? undefined;
    const _workId    = work.id;
    const _path      = `/watch/${slug}`;
    after(async () => {
      if (!_visitorId) return;
      try {
        const sessionId = await getOrCreateSession({ visitorId: _visitorId })
          .catch(() => undefined);
        await trackEvent({
          visitorId: _visitorId,
          userId: _userId,
          sessionId,
          type: "TRAILER_CLICK",
          path: _path,
          workId: _workId,
        });
      } catch { /* never block watch page */ }
    });
  }

  // Episode label (e.g. "S1 E2")
  const epLabel =
    isEpisode && (work.seasonNumber != null || work.episodeNumber != null)
      ? [
          work.seasonNumber != null ? `S${work.seasonNumber}` : null,
          work.episodeNumber != null ? `E${work.episodeNumber}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

  const backHref = isEpisode && work.parent ? `/works/${work.parent.slug}` : `/works/${work.slug}`;
  const backLabel = isEpisode && work.parent ? work.parent.title : work.title;

  return (
    <main className="watch-page">
      <div className="container-app">
        <Link href={backHref} className="watch-back">
          <ChevronLeft size={16} /> {backLabel}
        </Link>

        <p className="watch-label">
          {isEpisode
            ? (epLabel ?? "Episode")
            : isTrailer
            ? "Trailer"
            : "Full Film"}
        </p>

        <div className="watch-layout">
          {/* ── Main column ── */}
          <div className="watch-main">
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
                ) : isEpisode && nextEp ? (
                  <EpisodePlayer
                    src={videoUrl}
                    poster={work.posterUrl ?? undefined}
                    nextSlug={nextEp.slug}
                    workId={work.id}
                    initialSeconds={initialSeconds}
                    durationMinutes={work.duration ?? undefined}
                    cta={ctaProp}
                    ctaUser={ctaUser}
                  />
                ) : isEpisode ? (
                  <EpisodePlayer
                    src={videoUrl}
                    poster={work.posterUrl ?? undefined}
                    workId={work.id}
                    initialSeconds={initialSeconds}
                    durationMinutes={work.duration ?? undefined}
                    cta={ctaProp}
                    ctaUser={ctaUser}
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
                  />
                )
              ) : (
                <div className="watch-no-video">
                  <p>Video not available.</p>
                </div>
              )}
            </div>

            <div className="watch-info">
              <h1 className="watch-title">{work.title}</h1>
              {work.description && <p className="watch-desc">{work.description}</p>}

              <div className="watch-engagement">
                {session?.user && (
                  <SaveButton
                    workId={work.id}
                    initialSaved={isSaved}
                    className="save-btn save-btn--sm"
                  />
                )}
                <LikeButton
                  workId={work.id}
                  initialLiked={isLiked}
                  likeCount={likeCount}
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

              {/* Next Episode button */}
              {isEpisode && nextEp && (
                <Link href={`/watch/${nextEp.slug}`} className="watch-next-ep">
                  Next Episode <ChevronRight size={15} />
                </Link>
              )}

              {/* Trailer → Full Film upsell — not for TRAILER-type works (videoUrl IS the trailer) */}
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
                {siblings.map((ep) => {
                  const isCurrent = ep.slug === slug;
                  const num = [
                    ep.seasonNumber != null ? `S${ep.seasonNumber}` : null,
                    ep.episodeNumber != null ? `E${ep.episodeNumber}` : null,
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const dur = ep.duration
                    ? Math.floor(ep.duration / 60) > 0
                      ? `${Math.floor(ep.duration / 60)}h ${ep.duration % 60}m`
                      : `${ep.duration}m`
                    : null;

                  return (
                    <li
                      key={ep.id}
                      className={`watch-ep-item${isCurrent ? " watch-ep-item--current" : ""}`}
                    >
                      {isCurrent ? (
                        <div className="watch-ep-link watch-ep-link--static">
                          <div className="watch-ep-meta">
                            {num && <span className="watch-ep-num">{num}</span>}
                            {dur && <span className="watch-ep-dur">{dur}</span>}
                          </div>
                          <span className="watch-ep-title">{ep.title}</span>
                          <span className="watch-ep-now">Now Playing</span>
                        </div>
                      ) : (
                        <Link href={`/watch/${ep.slug}`} className="watch-ep-link">
                          <div className="watch-ep-meta">
                            {num && <span className="watch-ep-num">{num}</span>}
                            {dur && <span className="watch-ep-dur">{dur}</span>}
                          </div>
                          <span className="watch-ep-title">{ep.title}</span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </aside>
          )}
        </div>
      </div>

    </main>
  );
}
