import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { findSubtitle, updateSubtitleById, deleteSubtitleById } from "@/lib/subtitles/subtitle-repo";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const subtitle = await findSubtitle(id);
  if (!subtitle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ subtitle });
}

// PATCH: update label, sortOrder, isDefault
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    label?: string;
    sortOrder?: number;
    isDefault?: boolean;
  };

  const subtitle = await updateSubtitleById(id, body);
  return NextResponse.json({ subtitle });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await deleteSubtitleById(id);
  return NextResponse.json({ ok: true });
}
