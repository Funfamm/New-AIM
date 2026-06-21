import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { listSubtitleRevisions, restoreSubtitleRevision } from "@/lib/subtitles/subtitle-repo";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/subtitles/[id]/revisions
export async function GET(_req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const revisions = await listSubtitleRevisions(id);
  return NextResponse.json({
    revisions: revisions.map((r) => ({
      id: r.id,
      reason: r.reason ?? "edit",
      savedAt: r.createdAt.toISOString(),
      segmentCount: Array.isArray(r.snapshotJson) ? r.snapshotJson.length : 0,
    })),
  });
}

// POST /api/admin/subtitles/[id]/revisions  (body: { revisionId })
export async function POST(req: NextRequest, { params }: Ctx) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const { revisionId } = await req.json() as { revisionId?: string };
  if (!revisionId) return NextResponse.json({ error: "revisionId required" }, { status: 400 });

  const subtitle = await restoreSubtitleRevision(id, revisionId);
  if (!subtitle) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

  return NextResponse.json({ subtitle, ok: true });
}
