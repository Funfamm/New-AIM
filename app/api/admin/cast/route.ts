/**
 * GET  /api/admin/cast?workId=...  — list cast for a work
 * POST /api/admin/cast             — create cast member
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) return unauthorized();

  const workId = new URL(req.url).searchParams.get("workId") ?? "";
  if (!workId) return NextResponse.json({ error: "workId required" }, { status: 400 });

  const cast = await prisma.workCast.findMany({
    where: { workId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(cast);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { workId, name, jobTitle, character, bio, photoUrl, instagramUrl, sortOrder } = body;

  if (!workId || typeof workId !== "string") return NextResponse.json({ error: "workId required" }, { status: 400 });
  if (!name || typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) return NextResponse.json({ error: "jobTitle required" }, { status: 400 });

  // Verify the work exists
  const work = await prisma.work.findUnique({ where: { id: workId }, select: { id: true } });
  if (!work) return NextResponse.json({ error: "Work not found" }, { status: 404 });

  const member = await prisma.workCast.create({
    data: {
      workId,
      name: name.trim(),
      jobTitle: jobTitle.trim(),
      character: typeof character === "string" ? character.trim() || null : null,
      bio: typeof bio === "string" ? bio.trim().slice(0, 4000) || null : null,
      photoUrl: typeof photoUrl === "string" ? photoUrl.trim() || null : null,
      instagramUrl: typeof instagramUrl === "string" ? instagramUrl.trim() || null : null,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
    },
  });

  return NextResponse.json(member, { status: 201 });
}
