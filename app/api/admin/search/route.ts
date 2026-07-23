/**
 * GET /api/admin/search?q=...
 *
 * Global admin search — returns grouped results across works, users,
 * and subscribers. Admin-only, protected by requireAdmin().
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_GROUP = 5;

export async function GET(req: Request) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ works: [], users: [], subscribers: [] });

  const [works, users, subscribers] = await Promise.all([
    prisma.work.findMany({
      where: {
        type: { not: "EPISODE" },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { director: { contains: q, mode: "insensitive" } },
        ],
      },
      take: MAX_PER_GROUP,
      select: { id: true, title: true, type: true, status: true, slug: true, posterUrl: true },
      orderBy: { updatedAt: "desc" },
    }),

    prisma.user.findMany({
      where: {
        OR: [
          { name:  { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: MAX_PER_GROUP,
      select: { id: true, name: true, email: true, role: true, status: true },
      orderBy: { createdAt: "desc" },
    }),

    prisma.subscriber.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name:  { contains: q, mode: "insensitive" } },
        ],
      },
      take: MAX_PER_GROUP,
      select: { id: true, email: true, name: true, country: true },
      orderBy: { subscribedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ works, users, subscribers });
}
