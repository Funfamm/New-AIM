// Home page — cinematic hero with rotating posters + work rails
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import FilmRail from "@/components/film-rail";
import HeroRotator from "@/components/hero-rotator";
import MobileFeaturedHero from "@/components/mobile-featured-hero";
import { getWorkCtaState } from "@/lib/work-cta";
import { Play, ChevronRight } from "lucide-react";
import "./home.css";

const HOME_SELECT = {
  id: true, slug: true, title: true, posterUrl: true,
  heroMobileUrl: true, heroDesktopUrl: true,
  genre: true, genres: true, requiresAuth: true, type: true,
  trailerUrl: true, requiresLoginToViewTrailer: true, videoUrl: true,
} as const;

import type { WorkStatus } from "@prisma/client";

const HOME_STATUSES: { in: WorkStatus[] } = { in: ["PUBLISHED", "UPCOMING", "IN_PRODUCTION"] };

async function getHomeWorks() {
  const [featured, newReleases] = await Promise.all([
    prisma.work.findMany({
      where: { status: HOME_STATUSES, showOnHome: true, featured: true, type: { not: "EPISODE" } },
      orderBy: { order: "asc" },
      take: 6,
      select: HOME_SELECT,
    }),
    prisma.work.findMany({
      where: { status: HOME_STATUSES, showOnHome: true, type: { not: "EPISODE" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: HOME_SELECT,
    }),
  ]);
  return { featured, newReleases };
}

async function getPublishedTypes(): Promise<string[]> {
  const rows = await prisma.work.findMany({
    where: { status: HOME_STATUSES, type: { not: "EPISODE" } },
    select: { type: true },
    distinct: ["type"],
  });
  return rows.map((r) => r.type as string);
}

async function getSavedIds(userId: string): Promise<string[]> {
  const saved = await prisma.savedWork.findMany({
    where: { userId },
    select: { workId: true },
    take: 100,
  });
  return saved.map((s) => s.workId);
}

async function getContinueWatching(userId: string) {
  const progress = await prisma.watchProgress.findMany({
    where: {
      userId,
      completed: false,
      seconds: { gt: 0 },
      work: { status: "PUBLISHED", type: { not: "TRAILER" } },
    },
    select: { work: { select: HOME_SELECT } },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  return progress.map((p) => ({
    ...p.work,
    watchHref:
      p.work.type === "EPISODE" || p.work.type === "SERIES"
        ? `/watch/${p.work.slug}`
        : `/watch/${p.work.slug}?full=1`,
  }));
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [{ featured, newReleases }, continueWatching, savedIds, availableTypes] = await Promise.all([
    getHomeWorks(),
    userId
      ? getContinueWatching(userId)
      : Promise.resolve([] as Awaited<ReturnType<typeof getContinueWatching>>),
    userId ? getSavedIds(userId) : Promise.resolve<string[]>([]),
    getPublishedTypes(),
  ]);

  const featuredWithPosters = featured.filter((w) => w.posterUrl != null).slice(0, 5);

  const heroItems = featuredWithPosters.map((w) => ({
    posterUrl: w.posterUrl!,
    title: w.title,
    slug: w.slug,
    heroMobileUrl: w.heroMobileUrl,
    heroDesktopUrl: w.heroDesktopUrl,
  }));

  const mobileHeroItems = featuredWithPosters.map((w) => ({
    id: w.id,
    slug: w.slug,
    title: w.title,
    posterUrl: w.posterUrl!,
    heroMobileUrl: w.heroMobileUrl,
    requiresAuth: w.requiresAuth,
    genres: w.genres,
    type: w.type,
    trailerUrl: w.trailerUrl ?? null,
    requiresLoginToViewTrailer: w.requiresLoginToViewTrailer,
    videoUrl: w.videoUrl ?? null,
  }));

  const isEmpty = featured.length === 0 && newReleases.length === 0;

  return (
    <main>
      {/* ── Mobile streaming-style hero (<768px) ─────── */}
      <MobileFeaturedHero
        items={mobileHeroItems}
        isLoggedIn={!!userId}
        savedIds={savedIds}
        availableTypes={availableTypes}
      />

      {/* ── Desktop cinematic hero (≥768px) ──────────── */}
      <section className="hero">
        <div className="hero-bg">
          <HeroRotator items={heroItems} />
          <div className="hero-bg-gradient" />
        </div>
        <div className="hero-content">
          <span className="hero-eyebrow">— Now Streaming</span>
          <h1 className="hero-title">Cinema, reimagined.</h1>
          <p className="hero-desc">Original cinema built around story, emotion, memory, and the moments people refuse to look away from.</p>
          <div className="hero-actions">
            {(() => {
              const p = featuredWithPosters[0];
              if (!p) return (
                <Link href="/works" className="hero-btn-primary">
                  <Play size={16} fill="currentColor" /> Watch Our Films
                </Link>
              );
              const cta = getWorkCtaState({
                slug: p.slug,
                type: p.type,
                trailerUrl: p.trailerUrl,
                videoUrl: p.videoUrl,
                requiresAuth: p.requiresAuth,
                requiresLoginToViewTrailer: p.requiresLoginToViewTrailer,
                isGuest: !userId,
              });
              return (
                <>
                  {cta.primaryLabel ? (
                    <Link href={cta.primaryHref} className="hero-btn-primary">
                      <Play size={16} fill="currentColor" /> {cta.primaryLabel}
                    </Link>
                  ) : (
                    <Link href={`/works/${p.slug}`} className="hero-btn-primary">
                      View Details
                    </Link>
                  )}
                  {cta.secondaryLabel && cta.secondaryHref && (
                    <Link href={cta.secondaryHref} className="hero-btn-trailer">
                      {cta.secondaryLabel}
                    </Link>
                  )}
                </>
              );
            })()}
            <Link href="/about" className="hero-btn-secondary">
              Find Your Way In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Continue Watching ───────────────────────── */}
      {continueWatching.length > 0 && (
        <FilmRail title="Continue Watching" films={continueWatching.map(w => ({ ...w, requiresAuth: false }))} isLoggedIn={!!userId} />
      )}

      {/* ── Featured Works ──────────────────────────── */}
      <FilmRail
        title="Featured Works"
        label="— Now Streaming"
        href="/works"
        films={featured}
        priority
        isLoggedIn={!!userId}
      />

      {/* ── New Releases ────────────────────────────── */}
      <FilmRail title="New Releases" label="— Latest Work" href="/works" films={newReleases} isLoggedIn={!!userId} />

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

      {/* ── Studio Identity ─────────────────────────── */}
      <section className="studio-identity">
        <div className="container-app">
          <div className="si-grid">

            {/* Left — headline + copy + CTAs */}
            <div className="si-left">
              <span className="si-eyebrow">Why AIM Studio</span>
              <h2 className="si-headline">
                Cinema for the moments<br />
                we can&apos;t take back.
              </h2>
              <p className="si-body">
                Original films and series built around emotion, memory, sacrifice,
                and the people who refuse to look away.
              </p>
              <div className="si-ctas">
                <Link href="/works?collection=all" className="si-cta-primary">
                  <Play size={14} fill="currentColor" /> Explore Works
                </Link>
                <Link href="/about" className="si-cta-ghost">
                  Our Story <ChevronRight size={13} />
                </Link>
              </div>
            </div>

            {/* Right — 3 value cards */}
            <div className="si-right">
              <div className="si-card">
                <span className="si-card-num">01</span>
                <h3 className="si-card-title">Stories That Matter</h3>
                <p className="si-card-desc">Every film has to matter — to someone, somewhere. Not entertainment. Evidence.</p>
              </div>
              <div className="si-card">
                <span className="si-card-num">02</span>
                <h3 className="si-card-title">No Story Too Small</h3>
                <p className="si-card-desc">The personal is universal. If the story is true, it belongs on screen.</p>
              </div>
              <div className="si-card">
                <span className="si-card-num">03</span>
                <h3 className="si-card-title">Every Frame, On Purpose</h3>
                <p className="si-card-desc">No wasted shots. No filler. Every creative decision serves the story.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

    </main>
  );
}
