import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { findSubtitle, updateSubtitleById } from "@/lib/subtitles/subtitle-repo";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/subtitles/[id]/publish  — body: { published: boolean }
export async function POST(req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const subtitle = await findSubtitle(id);
  if (!subtitle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { published?: boolean };
  const isPublished = body.published ?? !subtitle.isPublished;

  const updated = await updateSubtitleById(id, { isPublished });
  return NextResponse.json({ subtitle: updated });
}
