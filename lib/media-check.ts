import "server-only";
import { prisma } from "@/lib/prisma";

// Media link checker — verifies that every public work's media URLs actually resolve.
// Born from a real incident: a published film's videoUrl pointed at a deleted R2 object
// (404) and a viewer failed to play it 15 times before anyone knew. This catches broken
// assets proactively (daily cron + on-demand admin page) instead of via viewer errors.

const PLAYBACK_FIELDS = ["videoUrl", "trailerUrl", "previewClipUrl", "teaserUrl"] as const;
const IMAGE_FIELDS    = ["posterUrl", "heroMobileUrl", "heroDesktopUrl", "thumbnailUrl"] as const;

type PlaybackField = (typeof PLAYBACK_FIELDS)[number];
type ImageField    = (typeof IMAGE_FIELDS)[number];
export type MediaField = PlaybackField | ImageField;

export type MediaLinkResult = {
  workId: string;
  slug: string;
  title: string;
  workStatus: string;
  field: MediaField;
  kind: "playback" | "image";
  url: string;
  /** HTTP status of the check, or null when the request itself failed (network/timeout). */
  httpStatus: number | null;
  ok: boolean;
};

const CHECK_TIMEOUT_MS = 5_000;
const BATCH_SIZE = 10;

// HEAD first (cheap); some hosts reject HEAD (405/501) — fall back to a 1-byte range GET.
async function checkUrl(url: string): Promise<{ httpStatus: number | null; ok: boolean }> {
  const attempt = async (method: "HEAD" | "GET") => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        signal: ctrl.signal,
        cache: "no-store",
        ...(method === "GET" ? { headers: { Range: "bytes=0-0" } } : {}),
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let res = await attempt("HEAD");
    if (res.status === 405 || res.status === 501) res = await attempt("GET");
    return { httpStatus: res.status, ok: res.ok || res.status === 206 };
  } catch {
    return { httpStatus: null, ok: false };
  }
}

/**
 * Check every media URL on public-facing works (published/upcoming/in-production,
 * episodes included — they carry their own videoUrl). Only absolute http(s) URLs are
 * checked; app-relative paths are bundled assets and can't 404 independently.
 * Results come back broken-first, playback before images.
 */
export async function checkAllWorkMediaLinks(): Promise<{
  results: MediaLinkResult[];
  checked: number;
  broken: MediaLinkResult[];
  worksScanned: number;
}> {
  const works = await prisma.work.findMany({
    where: { status: { in: ["PUBLISHED", "UPCOMING", "IN_PRODUCTION"] } },
    select: {
      id: true, slug: true, title: true, status: true,
      videoUrl: true, trailerUrl: true, previewClipUrl: true, teaserUrl: true,
      posterUrl: true, heroMobileUrl: true, heroDesktopUrl: true, thumbnailUrl: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const targets: Array<Omit<MediaLinkResult, "httpStatus" | "ok">> = [];
  for (const w of works) {
    const collect = (fields: readonly MediaField[], kind: "playback" | "image") => {
      for (const field of fields) {
        const url = w[field];
        if (typeof url === "string" && /^https?:\/\//i.test(url)) {
          targets.push({ workId: w.id, slug: w.slug, title: w.title, workStatus: w.status, field, kind, url });
        }
      }
    };
    collect(PLAYBACK_FIELDS, "playback");
    collect(IMAGE_FIELDS, "image");
  }

  const results: MediaLinkResult[] = [];
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const checked = await Promise.all(
      batch.map(async (t) => ({ ...t, ...(await checkUrl(t.url)) })),
    );
    results.push(...checked);
  }

  results.sort((a, b) =>
    Number(a.ok) - Number(b.ok) ||
    (a.kind === b.kind ? 0 : a.kind === "playback" ? -1 : 1) ||
    a.title.localeCompare(b.title),
  );

  return {
    results,
    checked: results.length,
    broken: results.filter((r) => !r.ok),
    worksScanned: works.length,
  };
}
