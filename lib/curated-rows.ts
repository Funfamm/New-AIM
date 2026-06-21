import { prisma } from "@/lib/prisma";
import type { RowPlacement } from "@prisma/client";
import type { RailFilm } from "@/components/film-rail";

const WORK_SELECT = {
  id: true,
  slug: true,
  title: true,
  posterUrl: true,
  heroMobileUrl: true,
  heroDesktopUrl: true,
  genre: true,
  genres: true,
  requiresAuth: true,
  type: true,
  trailerUrl: true,
  requiresLoginToViewTrailer: true,
  videoUrl: true,
  previewClipUrl: true,
  teaserUrl: true,
  status: true,
} as const;

export interface PublicContentRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  placement: RowPlacement;
  sortOrder: number;
  items: Array<{
    id: string;
    workId: string;
    sortOrder: number;
    work: RailFilm;
  }>;
}

/**
 * Get active curated rows for public rendering.
 * Filters by placement and active status.
 * Only includes published works in each row.
 * Skips rows with no published works.
 */
export async function getPublicContentRows(
  placement: RowPlacement
): Promise<PublicContentRow[]> {
  const rows = await prisma.contentRow.findMany({
    where: {
      placement: {
        in: [placement, "BOTH"] as RowPlacement[],
      },
      active: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      placement: true,
      sortOrder: true,
      items: {
        where: {
          work: {
            status: "PUBLISHED",
            type: { not: "EPISODE" },
          },
        },
        select: {
          id: true,
          workId: true,
          sortOrder: true,
          work: { select: WORK_SELECT },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Filter out rows with no published works
  return rows.filter((row) => row.items.length > 0);
}

/**
 * Check if any curated rows exist for a given placement.
 * Used to decide whether to show curated rows or fallback to default sections.
 */
export async function hasPublicContentRows(
  placement: RowPlacement
): Promise<boolean> {
  const rows = await getPublicContentRows(placement);
  return rows.length > 0;
}
