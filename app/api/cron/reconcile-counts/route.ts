/**
 * POST /api/cron/reconcile-counts
 *
 * Nightly data integrity job — fixes counter drift on Comment rows.
 * Compares stored likeCount / replyCount against actual DB row counts
 * and patches any mismatches.
 *
 * Protected by CRON_SECRET.
 * Recommended schedule: nightly at 02:00 UTC  "0 2 * * *"
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let replyCountFixes = 0;
  let likeCountFixes  = 0;

  // ── Fix Comment.replyCount ───────────────────────────────────
  // Actual reply count = published Comment rows with a matching parentId
  const replyCounts = await prisma.comment.groupBy({
    by: ["parentId"],
    where: { parentId: { not: null }, status: "PUBLISHED" },
    _count: { id: true },
  });

  for (const row of replyCounts) {
    if (!row.parentId) continue;
    const actual = row._count.id;
    const updated = await prisma.comment.updateMany({
      where: { id: row.parentId, replyCount: { not: actual } },
      data:  { replyCount: actual },
    });
    replyCountFixes += updated.count;
  }

  // Zero out replyCount for comments that have no replies stored
  const parentIds = new Set(replyCounts.map((r) => r.parentId).filter(Boolean) as string[]);
  if (parentIds.size > 0) {
    // Comments NOT in parentIds should have replyCount = 0
    const zeroed = await prisma.comment.updateMany({
      where: { id: { notIn: [...parentIds] }, parentId: null, replyCount: { gt: 0 } },
      data:  { replyCount: 0 },
    });
    replyCountFixes += zeroed.count;
  }

  // ── Fix Comment.likeCount ────────────────────────────────────
  const likeCounts = await prisma.commentLike.groupBy({
    by: ["commentId"],
    _count: { id: true },
  });

  for (const row of likeCounts) {
    const actual = row._count.id;
    const updated = await prisma.comment.updateMany({
      where: { id: row.commentId, likeCount: { not: actual } },
      data:  { likeCount: actual },
    });
    likeCountFixes += updated.count;
  }

  // Zero out likeCount for comments with no likes
  const likedCommentIds = new Set(likeCounts.map((r) => r.commentId));
  if (likedCommentIds.size > 0) {
    const zeroed = await prisma.comment.updateMany({
      where: { id: { notIn: [...likedCommentIds] }, likeCount: { gt: 0 } },
      data:  { likeCount: 0 },
    });
    likeCountFixes += zeroed.count;
  }

  return NextResponse.json({
    ok:              true,
    replyCountFixes,
    likeCountFixes,
    totalFixes:      replyCountFixes + likeCountFixes,
  });
}
