// Home page — cinematic hero + work rails
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import FilmRail from "@/components/film-rail";
import { Play, ChevronRight } from "lucide-react";

const HOME_SELECT = {
  id: true, slug: true, title: true, posterUrl: true,
  genre: true, requiresAuth: true,
} as const;

async function getHomeWorks() {
  const [featured, newReleases] = await Promise.all([
    prisma.work.findMany({
      where: { status: "PUBLISHED", showOnHome: true, featured: true, type: { not: "EPISODE" } },
      orderBy: { order: "asc" },
      take: 8,
      select: { ...HOME_SELECT, description: true },
    }),
    prisma.work.findMany({
      where: { status: "PUBLISHED", showOnHome: true, type: { not: "EPISODE" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: HOME_SELECT,
    }),
  ]);
  return { featured, newReleases };
}

async function getContinueWatching(userId: string) {
  const progress = await prisma.watchProgress.findMany({
    where: {
      userId,
      completed: false,
      seconds: { gt: 0 },
      work: { status: "PUBLISHED" },
    },
    select: {
      work: { select: HOME_SELECT },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  return progress.map((p) => p.work);
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [{ featured, newReleases }, continueWatching] = await Promise.all([
    getHomeWorks(),
    userId
      ? getContinueWatching(userId)
      : Promise.resolve([] as Awaited<ReturnType<typeof getContinueWatching>>),
  ]);

  const hero = featured[0] ?? newReleases[0] ?? null;

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg">
          {hero?.posterUrl && (
            <Image
              src={hero.posterUrl}
              alt=""
              fill
              priority
              style={{ objectFit: "cover", objectPosition: "center top", opacity: 0.65 }}
              aria-hidden={true}
            />
          )}
          <div className="hero-bg-gradient" />
        </div>
        <div className="container-app hero-content">
          <p className="hero-eyebrow">Now Streaming</p>
          <h1 className="hero-title">
            {hero ? hero.title : "AI-Generated\nCinema"}
          </h1>
          <p className="hero-desc">
            {(hero as { description?: string | null } | null)?.description ??
              "Groundbreaking films created with artificial intelligence. Stream trailers, discover new works, and experience the future of storytelling."}
          </p>
          <div className="hero-actions">
            {hero ? (
              <>
                <Link href={`/watch/${hero.slug}`} className="hero-btn-primary">
                  <Play size={16} fill="currentColor" /> Watch Trailer
                </Link>
                <Link href={`/works/${hero.slug}`} className="hero-btn-secondary">
                  Learn More
                </Link>
              </>
            ) : (
              <Link href="/works" className="hero-btn-primary">
                <Play size={16} fill="currentColor" /> Browse Works
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Rails ────────────────────────────────────── */}
      {continueWatching.length > 0 && (
        <FilmRail title="Continue Watching" films={continueWatching} />
      )}
      <FilmRail
        title="Featured Works"
        label="— Now Streaming"
        href="/works"
        films={featured}
        priority
      />
      <FilmRail
        title="New Releases"
        label="— Latest Work"
        href="/works"
        films={newReleases}
      />

      {featured.length === 0 && newReleases.length === 0 && (
        <section className="py-24 container-app">
          <p className="text-center font-body text-brand-muted">
            Works coming soon. Check back shortly.
          </p>
        </section>
      )}

      {/* ── About strip ──────────────────────────────── */}
      <section className="about-strip">
        <div className="container-app about-strip-inner">
          <div className="about-strip-text">
            <h2 className="about-strip-title">The Future of Film is Here</h2>
            <p className="about-strip-desc">
              AIM Studio creates AI-generated films that push the boundaries of
              storytelling. Watch trailers, follow your favourite creators, and
              stream full films on any device.
            </p>
            <Link href="/about" className="about-strip-link">
              Our Story <ChevronRight size={14} />
            </Link>
          </div>
          <div className="about-strip-stats">
            <div className="stat">
              <span className="stat-num">AI</span>
              <span className="stat-label">Generated</span>
            </div>
            <div className="stat">
              <span className="stat-num">4K</span>
              <span className="stat-label">Quality</span>
            </div>
            <div className="stat">
              <span className="stat-num">∞</span>
              <span className="stat-label">Stories</span>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        /* ── Hero ── */
        .hero {
          position: relative; min-height: 92dvh;
          display: flex; align-items: flex-end;
          padding-bottom: 5rem; overflow: hidden;
        }
        .hero-bg { position: absolute; inset: 0; z-index: 0; }
        .hero-bg-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.05) 25%,
            rgba(10,10,10,0.8) 70%, rgba(10,10,10,1) 100%
          );
        }
        .hero-content {
          position: relative; z-index: 1; max-width: 680px;
          animation: fadeUp 0.9s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-eyebrow {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--color-brand-accent); margin: 0 0 1rem;
        }
        .hero-title {
          font-family: var(--font-display); font-size: clamp(2.4rem, 7vw, 5rem);
          font-weight: 700; line-height: 1.05; letter-spacing: -0.02em;
          color: var(--color-brand-white); margin: 0 0 1.25rem; white-space: pre-line;
        }
        .hero-desc {
          font-family: var(--font-body); font-size: clamp(0.95rem, 2vw, 1rem);
          color: var(--color-brand-light); line-height: 1.7;
          max-width: 480px; margin: 0 0 2rem; opacity: 0.85;
        }
        .hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; }
        .hero-btn-primary {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-brand-black); background: var(--color-brand-accent);
          height: 52px; padding: 0 2rem; border-radius: 2px; text-decoration: none;
          transition: transform 0.2s, filter 0.2s;
        }
        .hero-btn-primary:hover { transform: translateY(-2px); filter: brightness(1.05); }
        .hero-btn-secondary {
          display: inline-flex; align-items: center;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 500;
          color: var(--color-brand-white); border: 1px solid rgba(255,255,255,0.3);
          height: 52px; padding: 0 2rem; border-radius: 2px; text-decoration: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .hero-btn-secondary:hover { border-color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.05); }

        /* ── About strip ── */
        .about-strip {
          background: var(--color-brand-dark); border-top: 1px solid var(--color-brand-border);
          border-bottom: 1px solid var(--color-brand-border); padding: 4rem 0; margin-top: 4rem;
        }
        .about-strip-inner { display: flex; flex-direction: column; gap: 2.5rem; }
        @media (min-width: 768px) {
          .about-strip-inner { flex-direction: row; align-items: center; justify-content: space-between; }
        }
        .about-strip-text { max-width: 520px; }
        .about-strip-title {
          font-family: var(--font-display); font-size: clamp(1.4rem, 3vw, 1.9rem);
          font-weight: 700; letter-spacing: -0.01em;
          color: var(--color-brand-white); margin: 0 0 0.75rem;
        }
        .about-strip-desc {
          font-family: var(--font-body); font-size: 0.95rem;
          color: var(--color-brand-muted); line-height: 1.7; margin: 0 0 1.25rem;
        }
        .about-strip-link {
          display: inline-flex; align-items: center; gap: 0.25rem;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 500;
          color: var(--color-brand-muted); text-decoration: none; transition: color 0.2s;
        }
        .about-strip-link:hover { color: var(--color-brand-white); }
        .about-strip-stats { display: flex; gap: 2.5rem; flex-shrink: 0; }
        .stat { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
        .stat-num {
          font-family: var(--font-display); font-size: 2rem; font-weight: 700;
          color: var(--color-brand-white); line-height: 1;
        }
        .stat-label {
          font-family: var(--font-body); font-size: 0.6875rem; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--color-brand-muted);
        }
      `}</style>
    </main>
  );
}
