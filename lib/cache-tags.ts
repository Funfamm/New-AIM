// Central cache-tag registry for `unstable_cache` / `revalidateTag`.
//
// Public homepage/listing loaders are wrapped in `unstable_cache` so bot/crawler
// traffic doesn't re-run the DB fan-out on every request (which exhausted the
// Prisma connection pool). `unstable_cache` lives in the Data Cache and is ONLY
// purged by `revalidateTag` — `revalidatePath` does not touch it. Keep producers
// (cached loaders) and invalidators (server actions / route handlers) pointed at
// the same constants here so they never drift out of sync.

export const CACHE_TAGS = {
  // Public catalog. Bump on any Work create/update/status/delete/reorder and on
  // HLS job completion (which writes videoUrl/trailerUrl/previewClipUrl onto a Work).
  works: "works",
  // Curated content rows (ContentRow / ContentRowItem) for HOME and WORKS placements.
  contentRows: "content-rows",
} as const;
