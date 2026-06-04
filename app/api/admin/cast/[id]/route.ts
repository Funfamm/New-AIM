/**
 * PUT    /api/admin/cast/[id]  — update cast member
 * DELETE /api/admin/cast/[id]  — delete cast member
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function PUT(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) return unauthorized();

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.workCast.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, jobTitle, character, bio, photoUrl, instagramUrl, sortOrder } = body;

  const updated = await prisma.workCast.update({
    where: { id },
    data: {
      ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
      ...(typeof jobTitle === "string" && jobTitle.trim() ? { jobTitle: jobTitle.trim() } : {}),
      character: typeof character === "string" ? character.trim() || null : undefined,
      bio: typeof bio === "string" ? bio.trim().slice(0, 4000) || null : undefined,
      photoUrl: typeof photoUrl === "string" ? photoUrl.trim() || null : undefined,
      instagramUrl: typeof instagramUrl === "string" ? instagramUrl.trim() || null : undefined,
      ...(typeof sortOrder === "number" ? { sortOrder } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) return unauthorized();

  const { id } = await params;

  const existing = await prisma.workCast.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.workCast.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
