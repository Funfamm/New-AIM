import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { withDbRetry } from "@/lib/db-retry";

// Cached so search-engine bots polling the sitemap don't each open a DB connection
// (during a Neon cold start that exhausted the pool elsewhere). Invalidated on any
// admin Work mutation via the "works" tag; also self-refreshes hourly.
const getSitemapWorks = unstable_cache(
  async () => {
    return prisma.work.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
  },
  ["sitemap-works"],
  { tags: [CACHE_TAGS.works], revalidate: 3600 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aimstudio.app";

  // The sitemap renders at BUILD time too — retry rides out a Neon cold start, and on
  // total failure degrade to the static routes instead of failing the whole build.
  // Catch is outside the cached loader so a transient failure is never cached.
  const works = await withDbRetry(() => getSitemapWorks()).catch(
    () => [] as Awaited<ReturnType<typeof getSitemapWorks>>,
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: appUrl,                   lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${appUrl}/works`,        lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${appUrl}/about`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${appUrl}/contact`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const workRoutes: MetadataRoute.Sitemap = works.map((w) => ({
    url:             `${appUrl}/works/${w.slug}`,
    lastModified:    w.updatedAt,
    changeFrequency: "weekly",
    priority:        0.8,
  }));

  return [...staticRoutes, ...workRoutes];
}
