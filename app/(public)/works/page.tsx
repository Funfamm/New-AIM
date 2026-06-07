import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import WorksClient from "@/components/works-client";
import FilmRail from "@/components/film-rail";
import { getPublicContentRows } from "@/lib/curated-rows";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Works — AIM Studio" };

type Props = {
  searchParams: Promise<{ collection?: string }>;
};

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
  const [works, { collection }, session, curatedRowsWorks] = await Promise.all([
    getWorks(),
    searchParams,
    auth(),
    getPublicContentRows("WORKS"),
  ]);

  const isLoggedIn = !!session?.user;

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

      {/* ── Works Grid with Tabs ────────────────────── */}
      <WorksClient works={works} collection={collection} isLoggedIn={isLoggedIn} />
    </main>
  );
}
