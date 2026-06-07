import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import WorksClient from "@/components/works-client";
import FilmRail from "@/components/film-rail";
import MobileFeaturedHero from "@/components/mobile-featured-hero";
import HeroDesktopSection from "@/components/hero-desktop-section";
import { getWorkCtaState } from "@/lib/work-cta";
import { getPublicContentRows } from "@/lib/curated-rows";
import type { Metadata } from "next";
import type { WorkStatus } from "@prisma/client";
import "../home.css";

export const metadata: Metadata = { title: "Works — AIM Studio" };

type Props = {
  searchParams: Promise<{ collection?: string }>;
};

const WORKS_HERO_SELECT = {
  id: true, slug: true, title: true, posterUrl: true,
  heroMobileUrl: true, heroDesktopUrl: true,
  genre: true, genres: true, requiresAuth: true, type: true,
  trailerUrl: true, requiresLoginToViewTrailer: true, videoUrl: true,
  previewClipUrl: true,
} as const;

const HERO_STATUSES: { in: WorkStatus[] } = { in: ["PUBLISHED", "UPCOMING", "IN_PRODUCTION"] };

async function getWorksHero() {
  return prisma.work.findMany({
    where: { status: HERO_STATUSES, featuredOnWorks: true, type: { not: "EPISODE" } },
    orderBy: { order: "asc" },
    select: {
      ...WORKS_HERO_SELECT,
      episodes: {
        where: { status: "PUBLISHED" },
        orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }, { order: "asc" }],
        select: { slug: true },
        take: 1,
      },
    },
  });
}

async function getWorks() {
  return prisma.work.findMany({
    where: {
      status: { in: ["PUBLISHED", "UPCOMING", "IN_PRODUCTION"] },
      type: { not: "EPISODE" },
    },
    orderBy: { order: "asc" },
    select: {
      id: true, slug: true, title: true, posterUrl: true,
      heroMobileUrl: true, heroDesktopUrl: true,
      genre: true, genres: true, requiresAuth: true, type: true, status: true,
      videoUrl: true, trailerUrl: true, requiresLoginToViewTrailer: true, previewClipUrl: true,
    },
  });
}

export default async function WorksPage({ searchParams }: Props) {
  const [heroWorks, works, { collection }, session, curatedRowsWorks] = await Promise.all([
    getWorksHero(),
    getWorks(),
    searchParams,
    auth(),
    getPublicContentRows("WORKS"),
  ]);

  const userId     = session?.user?.id ?? null;
  const isLoggedIn = !!userId;

  const heroWithPosters = heroWorks.filter(
    (w) => !!(w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl)
  );

  const heroDesktopItems = heroWithPosters.map((w) => {
    const firstEpSlug = w.episodes?.[0]?.slug ?? null;
    const cta = getWorkCtaState({
      slug: w.slug, type: w.type,
      trailerUrl: w.trailerUrl, videoUrl: w.videoUrl, previewClipUrl: w.previewClipUrl ?? null,
      requiresAuth: w.requiresAuth, requiresLoginToViewTrailer: w.requiresLoginToViewTrailer,
      isGuest: !userId, firstEpisodeSlug: firstEpSlug,
    });
    return {
      posterUrl:      (w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl)!,
      title:          w.title,
      slug:           w.slug,
      type:           w.type,
      genre:          w.genre ?? null,
      heroMobileUrl:  w.heroMobileUrl ?? null,
      heroDesktopUrl: w.heroDesktopUrl ?? null,
      primaryLabel:   cta.primaryLabel,
      primaryHref:    cta.primaryHref,
      secondaryLabel: cta.secondaryLabel,
      secondaryHref:  cta.secondaryHref,
    };
  });

  const mobileHeroItems = heroWithPosters.map((w) => ({
    id: w.id, slug: w.slug, title: w.title,
    posterUrl: (w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl)!,
    heroMobileUrl:  w.heroMobileUrl,
    requiresAuth:   w.requiresAuth,
    genres:         w.genres,
    type:           w.type,
    trailerUrl:     w.trailerUrl ?? null,
    requiresLoginToViewTrailer: w.requiresLoginToViewTrailer,
    videoUrl:       w.videoUrl ?? null,
    previewClipUrl: w.previewClipUrl ?? null,
  }));

  return (
    <main>
      {/* ── Works hero (mobile, <768px) ──────────────── */}
      {mobileHeroItems.length > 0 && (
        <MobileFeaturedHero
          items={mobileHeroItems}
          isLoggedIn={isLoggedIn}
          savedIds={[]}
          availableTypes={[]}
          hasUpcoming={false}
        />
      )}

      {/* ── Works hero (desktop, ≥768px) ─────────────── */}
      {heroDesktopItems.length > 0 && (
        <section className="hero">
          <HeroDesktopSection items={heroDesktopItems} />
        </section>
      )}

      {/* ── Curated Rows (WORKS/BOTH placement) ──────── */}
      {curatedRowsWorks.length > 0 && (
        <>
          {curatedRowsWorks.map((row) => (
            <FilmRail
              key={row.id}
              title={row.title}
              label={row.description ? `— ${row.description}` : undefined}
              films={row.items.map((item) => item.work)}
              isLoggedIn={isLoggedIn}
            />
          ))}
        </>
      )}

      {/* ── Works Grid with Tabs ────────────────────── */}
      <WorksClient works={works} collection={collection} isLoggedIn={isLoggedIn} />
    </main>
  );
}
