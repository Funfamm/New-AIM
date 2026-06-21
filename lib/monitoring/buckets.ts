import "server-only";
import { prisma } from "@/lib/prisma";

// Hourly occurrence rollups. One row per (fingerprint, hour) powers the sparkline
// and spike detection without storing a row per event — preserving the aggregate
// scalability model. All helpers are best-effort and never throw.

export const HOUR_MS = 3_600_000;
export const DAY_MS  = 86_400_000;

export function hourBucket(d: Date = new Date()): Date {
  return new Date(Math.floor(d.getTime() / HOUR_MS) * HOUR_MS);
}

// Increment the current-hour rollup. Returns the new bucket count (for spike
// detection) or null on failure.
export async function bumpBucket(fingerprint: string, by = 1): Promise<number | null> {
  try {
    const bucketStart = hourBucket();
    const row = await prisma.errorEventBucket.upsert({
      where:  { fingerprint_bucketStart: { fingerprint, bucketStart } },
      create: { fingerprint, bucketStart, count: by },
      update: { count: { increment: by } },
      select: { count: true },
    });
    return row.count;
  } catch {
    return null;
  }
}

export type SparkPoint = { t: number; count: number };

// Zero-filled occurrence series, oldest→newest, of `points` slots each `spanMs`
// wide (HOUR_MS for a 24h view, DAY_MS for a 7d/30d view). Hourly rows in the
// window are aggregated into the requested slots.
export async function series(fingerprint: string, points: number, spanMs: number): Promise<SparkPoint[]> {
  const nowAligned = Math.floor(Date.now() / spanMs) * spanMs;
  const since = nowAligned - (points - 1) * spanMs;
  const take = Math.ceil((points * spanMs) / HOUR_MS) + 1;

  const rows = await prisma.errorEventBucket.findMany({
    where:   { fingerprint, bucketStart: { gte: new Date(since) } },
    select:  { bucketStart: true, count: true },
    orderBy: { bucketStart: "asc" },
    take,
  }).catch(() => [] as { bucketStart: Date; count: number }[]);

  const slots = new Array<number>(points).fill(0);
  for (const r of rows) {
    const idx = Math.floor((r.bucketStart.getTime() - since) / spanMs);
    if (idx >= 0 && idx < points) slots[idx] += r.count;
  }
  return slots.map((count, i) => ({ t: since + i * spanMs, count }));
}

// Batched version for the list view — one query for many fingerprints. Capped at
// the 500-row take limit (most recent buckets first), which is ample for a page of
// errors that each have at most `points` recent buckets.
export async function seriesBatch(fingerprints: string[], points: number, spanMs: number): Promise<Map<string, SparkPoint[]>> {
  const out = new Map<string, SparkPoint[]>();
  if (fingerprints.length === 0) return out;

  const nowAligned = Math.floor(Date.now() / spanMs) * spanMs;
  const since = nowAligned - (points - 1) * spanMs;

  const rows = await prisma.errorEventBucket.findMany({
    where:   { fingerprint: { in: fingerprints }, bucketStart: { gte: new Date(since) } },
    select:  { fingerprint: true, bucketStart: true, count: true },
    orderBy: { bucketStart: "desc" },
    take:    500,
  }).catch(() => [] as { fingerprint: string; bucketStart: Date; count: number }[]);

  const slotsByFp = new Map<string, number[]>();
  for (const fp of fingerprints) slotsByFp.set(fp, new Array<number>(points).fill(0));
  for (const r of rows) {
    const slots = slotsByFp.get(r.fingerprint);
    if (!slots) continue;
    const idx = Math.floor((r.bucketStart.getTime() - since) / spanMs);
    if (idx >= 0 && idx < points) slots[idx] += r.count;
  }
  for (const [fp, slots] of slotsByFp) {
    out.set(fp, slots.map((count, i) => ({ t: since + i * spanMs, count })));
  }
  return out;
}
