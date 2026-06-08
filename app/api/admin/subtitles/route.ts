import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { listSubtitlesByWork, upsertSubtitle } from "@/lib/subtitles/subtitle-repo";
import { parseSubtitleFile } from "@/lib/subtitles/subtitle-file-parser";

// GET /api/admin/subtitles?workId=xxx
export async function GET(req: NextRequest) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const workId = req.nextUrl.searchParams.get("workId");
  if (!workId) return NextResponse.json({ error: "workId required" }, { status: 400 });

  const subtitles = await listSubtitlesByWork(workId);
  return NextResponse.json({ subtitles });
}

// POST /api/admin/subtitles  (multipart/form-data)
// Fields: workId, mediaType?, sourceLanguage?, label?, file (SRT/VTT)
export async function POST(req: NextRequest) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const form = await req.formData();
  const workId = form.get("workId") as string | null;
  const file = form.get("file") as File | null;

  if (!workId || !file) {
    return NextResponse.json({ error: "workId and file are required" }, { status: 400 });
  }

  const mediaType    = (form.get("mediaType") as string | null) ?? "full";
  const sourceLang   = (form.get("sourceLanguage") as string | null) ?? "en";
  const label        = (form.get("label") as string | null) ?? undefined;
  const content      = await file.text();

  let segments;
  try {
    segments = parseSubtitleFile(file.name, content);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  if (segments.length === 0) {
    return NextResponse.json({ error: "No subtitle segments found in file" }, { status: 422 });
  }

  const subtitle = await upsertSubtitle({
    workId, mediaType, sourceLanguage: sourceLang, label, segments,
  });

  return NextResponse.json({ subtitle }, { status: 201 });
}
