import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import type { Metadata } from "next";

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
      id: true, slug: true, title: true, status: true,
      trailerUrl: true, videoUrl: true,
      requiresAuth: true, posterUrl: true, description: true,
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

  const session = await auth();
  const wantFull = full === "1";

  if (wantFull && work.requiresAuth && !session?.user) {
    redirect(`/login?from=/watch/${slug}?full=1`);
  }

  const videoUrl = wantFull && work.videoUrl ? work.videoUrl : work.trailerUrl;
  const isTrailer = !wantFull || !work.videoUrl;

  const isYouTube = videoUrl?.includes("youtube.com") || videoUrl?.includes("youtu.be");
  const isVimeo   = videoUrl?.includes("vimeo.com");
  const isEmbed   = isYouTube || isVimeo;
  const embedUrl  = videoUrl ? toEmbedUrl(videoUrl) : null;

  return (
    <main className="watch-page">
      <div className="container-app">
        <Link href={`/works/${work.slug}`} className="watch-back">
          <ChevronLeft size={16} /> {work.title}
        </Link>

        <p className="watch-label">{isTrailer ? "Trailer" : "Full Film"}</p>

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

          {isTrailer && work.videoUrl && (
            <div className="watch-upsell">
              {work.requiresAuth && !session?.user ? (
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
          color: var(--color-brand-accent); margin-bottom: 1rem;
        }
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
        .watch-upsell {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-family: var(--font-body); font-size: 0.85rem; color: var(--color-brand-muted);
          background: var(--color-brand-surface); border: 1px solid var(--color-brand-border);
          padding: 0.75rem 1.25rem; border-radius: 4px;
        }
        .watch-upsell a { color: var(--color-brand-accent); text-decoration: none; }
        .watch-upsell a:hover { text-decoration: underline; }
        .watch-upsell-btn { color: var(--color-brand-accent) !important; font-weight: 600; }
      `}</style>
    </main>
  );
}
