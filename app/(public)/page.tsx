// Home page — cinematic hero with rotating posters + work rails
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import FilmRail from "@/components/film-rail";
import HeroRotator from "@/components/hero-rotator";
import { Play, ChevronRight } from "lucide-react";

const HOME_SELECT = {
  id: true, slug: true, title: true, posterUrl: true,
  genre: true, requiresAuth: true, type: true,
} as const;

async function getHomeWorks() {
  const [featured, newReleases] = await Promise.all([
    prisma.work.findMany({
      where: { status: "PUBLISHED", showOnHome: true, featured: true, type: { not: "EPISODE" } },
      orderBy: { order: "asc" },
      take: 6,
      select: HOME_SELECT,
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
    select: { work: { select: HOME_SELECT } },
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

  const heroItems = featured
    .filter((w) => w.posterUrl != null)
    .slice(0, 5)
    .map((w) => ({ posterUrl: w.posterUrl!, title: w.title }));

  const isEmpty = featured.length === 0 && newReleases.length === 0;

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg">
          <HeroRotator items={heroItems} />
          <div className="hero-bg-gradient" />
        </div>
        <div className="hero-content">
          <span className="hero-eyebrow">— Now Streaming</span>
          <h1 className="hero-title">Cinema, reimagined.</h1>
          <p className="hero-desc">We make films about what we almost lost.</p>
          <div className="hero-actions">
            <Link href="/works" className="hero-btn-primary">
              <Play size={16} fill="currentColor" /> Watch Our Films
            </Link>
            <Link href="/about" className="hero-btn-secondary">
              Find Your Way In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Continue Watching ───────────────────────── */}
      {continueWatching.length > 0 && (
        <FilmRail title="Continue Watching" films={continueWatching} />
      )}

      {/* ── Featured Works ──────────────────────────── */}
      <FilmRail
        title="Featured Works"
        label="— Now Streaming"
        href="/works"
        films={featured}
        priority
      />

      {/* ── New Releases ────────────────────────────── */}
      <FilmRail title="New Releases" label="— Latest Work" href="/works" films={newReleases} />

      {/* ── Empty state ─────────────────────────────── */}
      {isEmpty && (
        <section className="home-empty">
          <div className="container-app">
            <p className="home-empty-text">We&apos;re cooking. The first films drop soon.</p>
          </div>
        </section>
      )}

      {/* ── Brand strip ─────────────────────────────── */}
      {!isEmpty && (
        <div className="brand-strip">
          <div className="container-app">
            <p className="brand-strip-text">
              Stories That Matter&nbsp;&nbsp;·&nbsp;&nbsp;No Story Too Small&nbsp;&nbsp;·&nbsp;&nbsp;Every Frame, On Purpose.
            </p>
          </div>
        </div>
      )}

      {/* ── Studio Statement ────────────────────────── */}
      <section className="studio-statement">
        <div className="container-app">
          <blockquote className="statement-quote">
            Films that couldn&apos;t exist before now.
          </blockquote>
          <Link href="/about" className="statement-link">
            Our Story <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      <style>{`
        /* ── Hero ── */
        .hero {
          position: relative;
          min-height: 95dvh;
          overflow: hidden;
          background-color: var(--color-brand-dark);
        }
        .hero-bg { position: absolute; inset: 0; z-index: 0; }
        .hero-bg-gradient {
          position: absolute; inset: 0;
          background:
            linear-gradient(to right,  rgba(10,10,10,0.78) 0%, rgba(10,10,10,0.25) 45%, rgba(10,10,10,0) 65%),
            linear-gradient(to top,    rgba(10,10,10,0.96) 0%, rgba(10,10,10,0.62) 20%, rgba(10,10,10,0.10) 55%, rgba(10,10,10,0) 100%);
        }
        .hero-content {
          position: absolute;
          left: 1.5rem; right: 1.5rem; bottom: 2.5rem;
          z-index: 1;
          max-width: 520px;
        }
        @media (min-width: 768px) {
          .hero-content { left: 7vw; right: auto; bottom: 18vh; }
        }
        .hero-eyebrow {
          display: block;
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--color-brand-accent); margin-bottom: 0.875rem;
        }
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(2.75rem, 5vw, 4.75rem);
          font-weight: 700; line-height: 1.05; letter-spacing: -0.02em;
          color: var(--color-brand-white); margin: 0 0 1rem;
        }
        .hero-desc {
          font-family: var(--font-body); font-size: 1rem;
          color: var(--color-brand-light); line-height: 1.6;
          margin: 0 0 1.75rem; opacity: 0.88;
        }
        .hero-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .hero-btn-primary {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--color-brand-black); background: var(--color-brand-accent);
          height: 52px; padding: 0 2rem; border-radius: 2px; text-decoration: none;
          transition: filter 0.2s, transform 0.2s; touch-action: manipulation;
        }
        .hero-btn-primary:hover { filter: brightness(1.06); transform: translateY(-2px); }
        .hero-btn-secondary {
          display: inline-flex; align-items: center;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 500;
          color: var(--color-brand-white); border: 1px solid rgba(255,255,255,0.3);
          height: 52px; padding: 0 2rem; border-radius: 2px; text-decoration: none;
          transition: border-color 0.2s, background 0.2s, transform 0.2s; touch-action: manipulation;
        }
        .hero-btn-secondary:hover { border-color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.05); transform: translateY(-2px); }

        /* ── Empty state ── */
        .home-empty { padding: 6rem 0; }
        .home-empty-text {
          font-family: var(--font-body); font-size: 1rem;
          color: var(--color-brand-muted); text-align: center; margin: 0;
        }

        /* ── Brand strip ── */
        .brand-strip {
          border-top: 1px solid var(--color-brand-border);
          border-bottom: 1px solid var(--color-brand-border);
          padding: 1.25rem 0;
          margin-top: 4rem;
        }
        .brand-strip-text {
          font-family: var(--font-body); font-size: 0.6875rem; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--color-brand-muted); text-align: center; margin: 0;
        }

        /* ── Studio Statement ── */
        .studio-statement {
          position: relative; overflow: hidden;
          padding: 6rem 0 8rem;
        }
        .studio-statement::before {
          content: ''; position: absolute;
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 600px; height: 300px;
          background: radial-gradient(ellipse 80% 60% at 50% 50%, rgba(232,201,126,0.05) 0%, transparent 70%);
          pointer-events: none;
        }
        .statement-quote {
          font-family: var(--font-display);
          font-size: clamp(2.25rem, 6vw, 4.5rem);
          font-weight: 700; letter-spacing: -0.02em; line-height: 1.1;
          color: var(--color-brand-white); margin: 0 0 2rem; max-width: 640px;
        }
        .statement-link {
          display: inline-flex; align-items: center; gap: 0.25rem;
          font-family: var(--font-body); font-size: 0.875rem; font-weight: 500;
          color: var(--color-brand-accent); text-decoration: none;
          letter-spacing: 0.04em; transition: opacity 0.2s;
        }
        .statement-link:hover { opacity: 0.72; }
      `}</style>
    </main>
  );
}
