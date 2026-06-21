// Home page — cinematic hero with rotating posters + work rails
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import FilmRail from "@/components/film-rail";
import MobileFeaturedHero from "@/components/mobile-featured-hero";
import HeroDesktopSection from "@/components/hero-desktop-section";
import { getWorkCtaState } from "@/lib/work-cta";
import { getPublicContentRows } from "@/lib/curated-rows";
import { Play, ChevronRight } from "lucide-react";
import "./home.css";

const HOME_SELECT = {
  id: true, slug: true, title: true, posterUrl: true,
  heroMobileUrl: true, heroDesktopUrl: true,
  genre: true, genres: true, requiresAuth: true, type: true,
  trailerUrl: true, requiresLoginToViewTrailer: true, videoUrl: true,
  previewClipUrl: true, heroPreviewDuration: true,
} as const;

import type { WorkStatus } from "@prisma/client";

const HOME_STATUSES: { in: WorkStatus[] } = { in: ["PUBLISHED", "UPCOMING", "IN_PRODUCTION"] };

async function getHomeWorks() {
  const [featured, newReleases] = await Promise.all([
    // Featured: include first-episode slug so "Watch Series" CTA works on hero
    prisma.work.findMany({
      where: { status: HOME_STATUSES, featuredOnHome: true, type: { not: "EPISODE" } },
      orderBy: { order: "asc" },
      select: {
        ...HOME_SELECT,
        episodes: {
          where: { status: "PUBLISHED" },
          orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
          select: { slug: true },
          take: 1,
        },
      },
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

async function getPublishedTypes(): Promise<{ types: string[]; hasUpcoming: boolean }> {
  // Two separate queries so the concepts stay clean:
  //   types      = distinct WorkType values from PUBLISHED works shown on home
  //   hasUpcoming = whether any UPCOMING/IN_PRODUCTION works exist on home
  // This way Films/Series/Shorts tabs only appear when real published content
  // exists, and Upcoming only appears when there is genuinely upcoming content.
  const [typeRows, upcomingCount] = await Promise.all([
    prisma.work.findMany({
      where: { status: "PUBLISHED", showOnHome: true, type: { not: "EPISODE" } },
      select: { type: true },
      distinct: ["type"],
    }),
    prisma.work.count({
      where: { status: { in: ["UPCOMING", "IN_PRODUCTION"] }, showOnHome: true, type: { not: "EPISODE" } },
    }),
  ]);
  return {
    types:       typeRows.map((r) => r.type as string),
    hasUpcoming: upcomingCount > 0,
  };
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

  const [
    { featured, newReleases },
    continueWatching,
    savedIds,
    { types: availableTypes, hasUpcoming },
    curatedRowsHome,
  ] = await Promise.all([
    getHomeWorks(),
    userId
      ? getContinueWatching(userId)
      : Promise.resolve([] as Awaited<ReturnType<typeof getContinueWatching>>),
    userId ? getSavedIds(userId) : Promise.resolve<string[]>([]),
    getPublishedTypes(),
    getPublicContentRows("HOME"),
  ]);

  const featuredWithPosters = featured.filter(
    (w) => !!(w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl)
  );

  // Pre-compute CTA states for all featured works so the desktop hero can
  // update its buttons in sync with whichever slide the rotator is showing.
  const heroDesktopItems = featuredWithPosters.map((w) => {
    const firstEpSlug = w.episodes?.[0]?.slug ?? null;
    const cta = getWorkCtaState({
      slug: w.slug,
      type: w.type,
      trailerUrl: w.trailerUrl,
      videoUrl: w.videoUrl,
      previewClipUrl: w.previewClipUrl ?? null,
      requiresAuth: w.requiresAuth,
      requiresLoginToViewTrailer: w.requiresLoginToViewTrailer,
      isGuest: !userId,
      firstEpisodeSlug: firstEpSlug,
    });
    return {
      posterUrl:       (w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl)!,
      title:           w.title,
      slug:            w.slug,
      type:            w.type,
      genre:           w.genre ?? null,
      heroMobileUrl:   w.heroMobileUrl ?? null,
      heroDesktopUrl:  w.heroDesktopUrl ?? null,
      previewClipUrl:       w.previewClipUrl ?? null,
      previewClipDuration:  w.heroPreviewDuration ?? null,
      primaryLabel:    cta.primaryLabel,
      primaryHref:     cta.primaryHref,
      secondaryLabel:  cta.secondaryLabel,
      secondaryHref:   cta.secondaryHref,
    };
  });

  // mobileHeroItems — passed to MobileFeaturedHero (mobile only, <768px)
  const mobileHeroItems = featuredWithPosters.map((w) => ({
    id: w.id,
    slug: w.slug,
    title: w.title,
    posterUrl: (w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl)!,
    heroMobileUrl: w.heroMobileUrl,
    requiresAuth: w.requiresAuth,
    genres: w.genres,
    type: w.type,
    trailerUrl: w.trailerUrl ?? null,
    requiresLoginToViewTrailer: w.requiresLoginToViewTrailer,
    videoUrl: w.videoUrl ?? null,
    previewClipUrl: w.previewClipUrl ?? null,
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
        hasUpcoming={hasUpcoming}
      />

      {/* ── Desktop cinematic hero (≥768px) ──────────── */}
      {/* HeroDesktopSection is a client component that syncs CTA buttons   */}
      {/* with the active rotator slide — fixes "Watch Short" staying on    */}
      {/* screen while a Series (Grandpa's Diary) is displayed.             */}
      <section className="hero">
        <HeroDesktopSection items={heroDesktopItems} />
      </section>

      {/* ── Continue Watching ───────────────────────── */}
      {continueWatching.length > 0 && (
        <FilmRail title="Continue Watching" films={continueWatching.map(w => ({ ...w, requiresAuth: false }))} isLoggedIn={!!userId} />
      )}

      {/* ── Curated Rows (HOME/BOTH placement) ───────── */}
      {curatedRowsHome.length > 0 ? (
        curatedRowsHome.map((row) => (
          <FilmRail
            key={row.id}
            title={row.title}
            label={row.description ? `— ${row.description}` : undefined}
            films={row.items.map((item) => item.work)}
            isLoggedIn={!!userId}
          />
        ))
      ) : (
        <>
          {/* ── Featured Works (fallback) ──────────────────────────── */}
          <FilmRail
            title="Featured Works"
            label="— Now Streaming"
            href="/works"
            films={featured}
            priority
            isLoggedIn={!!userId}
          />

          {/* ── New Releases (fallback) ────────────────────────────── */}
          <FilmRail title="New Releases" label="— Latest Work" href="/works" films={newReleases} isLoggedIn={!!userId} />
        </>
      )}

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
