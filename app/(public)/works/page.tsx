import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getWorksWithOpenCastingRoles } from "@/lib/actions/casting";
import WorksClient from "@/components/works-client";
import FilmRail from "@/components/film-rail";
import { getPublicContentRows } from "@/lib/curated-rows";
import type { Metadata } from "next";
import type { WorkStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Works — AIM Studio" };

type Props = {
  searchParams: Promise<{ collection?: string }>;
};

const HERO_STATUSES: { in: WorkStatus[] } = { in: ["PUBLISHED", "UPCOMING", "IN_PRODUCTION"] };

async function getWorksHero() {
  return prisma.work.findMany({
    where: { status: HERO_STATUSES, featuredOnWorks: true, type: { not: "EPISODE" } },
    orderBy: { order: "asc" },
    select: {
      posterUrl: true, heroMobileUrl: true, heroDesktopUrl: true,
      title: true, slug: true, previewClipUrl: true, heroPreviewDuration: true,
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
      videoUrl: true, trailerUrl: true, requiresLoginToViewTrailer: true,
      previewClipUrl: true, heroPreviewDuration: true,
    },
  });
}

export default async function WorksPage({ searchParams }: Props) {
  const [heroWorks, works, { collection }, session, curatedRowsWorks, castingWorkIds] = await Promise.all([
    getWorksHero(),
    getWorks(),
    searchParams,
    auth(),
    getPublicContentRows("WORKS"),
    getWorksWithOpenCastingRoles().then((s) => [...s]).catch(() => [] as string[]),
  ]);

  const userId     = session?.user?.id ?? null;
  const isLoggedIn = !!userId;

  // Build hero items for the Works page background rotator.
  // Uses image fallback chain so works without posterUrl still display.
  const worksHeroItems = heroWorks
    .filter((w) => !!(w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl))
    .map((w) => ({
      posterUrl:      (w.posterUrl ?? w.heroMobileUrl ?? w.heroDesktopUrl)!,
      title:          w.title,
      slug:           w.slug,
      heroMobileUrl:       w.heroMobileUrl ?? null,
      heroDesktopUrl:      w.heroDesktopUrl ?? null,
      previewClipUrl:      w.previewClipUrl ?? null,
      previewClipDuration: w.heroPreviewDuration ?? null,
    }));

  return (
    <main>
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

      {/* ── Works Grid with Tabs (includes hero, search, tabs) ── */}
      <WorksClient
        works={works}
        collection={collection}
        isLoggedIn={isLoggedIn}
        featuredHeroItems={worksHeroItems.length > 0 ? worksHeroItems : undefined}
        castingWorkIds={castingWorkIds}
      />
    </main>
  );
}
