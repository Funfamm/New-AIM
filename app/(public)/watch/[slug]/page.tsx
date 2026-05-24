import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import type { Metadata } from "next";
import EpisodePlayer from "@/components/episode-player";

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
      episodeNumber: true, seasonNumber: true,
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
                  />
                ) : (
                  <video
                    src={videoUrl}
                    className="watch-video"
                    controls
                    playsInline
                    poster={work.posterUrl ?? undefined}
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

      <style>{`
        .watch-page { padding: 2rem 0 6rem; }
        .watch-back {
          display: inline-flex; align-items: center; gap: 0.3rem;
          font-family: var(--font-body); font-size: 0.8rem;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-brand-muted); text-decoration: none;
          margin-bottom: 1rem; transition: color 0.2s;
        }
        .watch-back:hover { color: var(--color-brand-white); }
        .watch-label {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--color-brand-accent); margin: 0 0 1rem;
        }

        /* ── Two-column layout ── */
        .watch-layout { display: flex; flex-direction: column; gap: 2rem; }
        @media (min-width: 1024px) {
          .watch-layout { flex-direction: row; align-items: flex-start; gap: 2rem; }
          .watch-main { flex: 1; min-width: 0; }
          .watch-ep-sidebar { width: 272px; flex-shrink: 0; position: sticky; top: 88px; max-height: calc(100vh - 100px); overflow: hidden; display: flex; flex-direction: column; }
        }

        /* ── Player ── */
        .watch-player-wrap {
          position: relative; width: 100%; aspect-ratio: 16/9;
          background: #000; border-radius: 4px; overflow: hidden;
          border: 1px solid var(--color-brand-border);
        }
        .watch-iframe, .watch-video {
          position: absolute; inset: 0; width: 100%; height: 100%;
          border: none; display: block;
        }
        .watch-no-video {
          position: absolute; inset: 0; display: flex; align-items: center;
          justify-content: center; color: var(--color-brand-muted); font-family: var(--font-body);
        }

        /* ── Info ── */
        .watch-info { padding: 1.5rem 0; max-width: 720px; }
        .watch-title {
          font-family: var(--font-display); font-size: clamp(1.4rem, 4vw, 2rem);
          font-weight: 700; letter-spacing: -0.01em;
          color: var(--color-brand-white); margin: 0 0 0.75rem;
        }
        .watch-desc {
          font-family: var(--font-body); font-size: 0.92rem;
          color: var(--color-brand-muted); line-height: 1.7; margin: 0 0 1.25rem;
        }
        .watch-next-ep {
          display: inline-flex; align-items: center; gap: 0.35rem;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 600;
          color: var(--color-brand-accent); text-decoration: none;
          margin-bottom: 1.25rem; transition: opacity 0.15s;
        }
        .watch-next-ep:hover { opacity: 0.72; }

        /* ── Upsell ── */
        .watch-upsell {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-family: var(--font-body); font-size: 0.85rem; color: var(--color-brand-muted);
          background: var(--color-brand-surface); border: 1px solid var(--color-brand-border);
          padding: 0.75rem 1.25rem; border-radius: 4px;
        }
        .watch-upsell a { color: var(--color-brand-accent); text-decoration: none; }
        .watch-upsell a:hover { text-decoration: underline; }
        .watch-upsell-btn { color: var(--color-brand-accent) !important; font-weight: 600; }

        /* ── Episode sidebar ── */
        .watch-ep-sidebar {
          border: 1px solid var(--color-brand-border);
          border-radius: 4px; overflow: hidden;
          background: var(--color-brand-dark);
        }
        .watch-ep-sidebar-label {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--color-brand-muted);
          padding: 0.875rem 1rem; margin: 0;
          border-bottom: 1px solid var(--color-brand-border);
          flex-shrink: 0;
        }
        .watch-ep-list {
          list-style: none; margin: 0; padding: 0;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--color-brand-border) transparent;
        }
        .watch-ep-item { border-bottom: 1px solid var(--color-brand-border); }
        .watch-ep-item:last-child { border-bottom: none; }
        .watch-ep-item--current { background: rgba(255,255,255,0.04); }
        .watch-ep-link {
          display: flex; flex-direction: column; gap: 0.2rem;
          padding: 0.875rem 1rem; text-decoration: none;
          transition: background 0.15s;
        }
        .watch-ep-link:not(.watch-ep-link--static):hover { background: rgba(255,255,255,0.05); }
        .watch-ep-meta { display: flex; align-items: center; gap: 0.6rem; }
        .watch-ep-num {
          font-family: var(--font-body); font-size: 0.65rem; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--color-brand-accent);
        }
        .watch-ep-dur {
          font-family: var(--font-body); font-size: 0.65rem;
          color: var(--color-brand-muted);
        }
        .watch-ep-title {
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 500;
          color: var(--color-brand-white); line-height: 1.35;
        }
        .watch-ep-now {
          font-family: var(--font-body); font-size: 0.625rem; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--color-brand-accent); margin-top: 0.1rem;
        }
      `}</style>
    </main>
  );
}
