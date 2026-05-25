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
import { isWorkSaved } from "@/lib/actions/watchlist";
import { getOrCreateSession, trackEvent } from "@/lib/analytics";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ full?: string }>;
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
      requiresAuth: true, posterUrl: true, description: true,
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
  const { full } = await searchParams;
  const work = await getWork(slug);

  if (!work || work.status !== "PUBLISHED") notFound();

  // SERIES with episodes → redirect to episode 1
  if (work.type === "SERIES" && work.episodes.length > 0) {
    redirect(`/watch/${work.episodes[0].slug}`);
  }

  const session = await auth();
  const isEpisode = work.type === "EPISODE";

  // Access control — episode inherits parent series requiresAuth
  const parentRequiresAuth = isEpisode && (work.parent?.requiresAuth ?? false);
  const requiresAuth = work.requiresAuth || parentRequiresAuth;
  const wantFull = isEpisode ? true : full === "1";

  if (wantFull && requiresAuth && !session?.user) {
    const from = isEpisode ? `/watch/${slug}` : `/watch/${slug}?full=1`;
    redirect(`/login?from=${from}`);
  }

  // Video selection
  const videoUrl = isEpisode
    ? work.videoUrl
    : wantFull && work.videoUrl
    ? work.videoUrl
    : work.trailerUrl;
  const isTrailer = !isEpisode && (!wantFull || !work.videoUrl);

  const isYouTube = videoUrl?.includes("youtube.com") || videoUrl?.includes("youtu.be");
  const isVimeo   = videoUrl?.includes("vimeo.com");
  const isEmbed   = isYouTube || isVimeo;
  const embedUrl  = videoUrl ? toEmbedUrl(videoUrl) : null;

  // Trailers always restart from the beginning — never resume
  const initialSeconds = session?.user && !isEmbed && !isTrailer && work.id
    ? await getWatchProgress(work.id)
    : 0;
  const isSaved = session?.user ? await isWorkSaved(work.id) : false;

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

  // Episode navigation
  const siblings = work.parent?.episodes ?? [];
  const currentIdx = siblings.findIndex((ep) => ep.slug === slug);
  const nextEp = currentIdx >= 0 && currentIdx < siblings.length - 1
    ? siblings[currentIdx + 1]
    : null;

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
                  />
                ) : isEpisode ? (
                  <EpisodePlayer
                    src={videoUrl}
                    poster={work.posterUrl ?? undefined}
                    workId={work.id}
                    initialSeconds={initialSeconds}
                    durationMinutes={work.duration ?? undefined}
                  />
                ) : (
                  <VideoPlayer
                    src={videoUrl}
                    poster={work.posterUrl ?? undefined}
                    workId={work.id}
                    initialSeconds={initialSeconds}
                    durationMinutes={work.duration ?? undefined}
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

              {session?.user && (
                <SaveButton
                  workId={work.id}
                  initialSaved={isSaved}
                  className="save-btn save-btn--sm"
                />
              )}

              {/* Next Episode button */}
              {isEpisode && nextEp && (
                <Link href={`/watch/${nextEp.slug}`} className="watch-next-ep">
                  Next Episode <ChevronRight size={15} />
                </Link>
              )}

              {/* Trailer → Full Film upsell */}
              {isTrailer && work.videoUrl && (
                <div className="watch-upsell">
                  {requiresAuth && !session?.user ? (
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
