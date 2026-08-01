import { NextRequest, NextResponse } from "next/server";
import { findSubtitle } from "@/lib/subtitles/subtitle-repo";
import { segmentsToVtt } from "@/lib/subtitles/vtt-storage";
import type { SubtitleSegment } from "@/lib/subtitles/subtitle-file-parser";

// GET /api/subtitles/[workId]/vtt?subtitleId=…&lang=…
// Serves VTT content for a published subtitle when no R2 key exists yet.
export async function GET(req: NextRequest, _ctx: { params: Promise<{ workId: string }> }) {
  const { searchParams } = req.nextUrl;
  const subtitleId = searchParams.get("subtitleId");
  const lang = searchParams.get("lang");

  if (!subtitleId || !lang) {
    return new NextResponse("Missing subtitleId or lang", { status: 400 });
  }

  const sub = await findSubtitle(subtitleId);
  if (!sub || !sub.isPublished) {
    return new NextResponse("Not found", { status: 404 });
  }

  let segments: SubtitleSegment[] | null = null;

  if (lang === sub.sourceLanguage) {
    segments = sub.segmentsJson;
  } else {
    const translations = sub.translationsJson as Record<string, SubtitleSegment[]> | null;
    if (translations) segments = translations[lang] ?? null;
  }

  if (!segments || segments.length === 0) {
    return new NextResponse("No subtitle data", { status: 404 });
  }

  const vtt = segmentsToVtt(segments);

  return new NextResponse(vtt, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
