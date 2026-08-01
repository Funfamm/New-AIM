import { NextRequest, NextResponse } from "next/server";
import { listPublishedSubtitles } from "@/lib/subtitles/subtitle-repo";
import { getVttUrl } from "@/lib/subtitles/vtt-storage";
import { getLangName } from "@/lib/subtitles/subtitle-languages";

type Ctx = { params: Promise<{ workId: string }> };

// GET /api/subtitles/[workId]
// Returns published subtitle tracks suitable for <track> elements in the player.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { workId } = await params;
  const subtitles = await listPublishedSubtitles(workId);

  const tracks: {
    subtitleId: string;
    lang: string;
    label: string;
    src: string;
    isDefault: boolean;
  }[] = [];

  for (const sub of subtitles) {
    const vttKeys = sub.vttKeysJson ?? {};
    const srcLang = sub.sourceLanguage;
    const addedLangs = new Set<string>();

    // Source language — prefer R2 CDN key, fall back to on-demand VTT route
    const srcSrc =
      getVttUrl(srcLang, vttKeys) ??
      (sub.segmentsJson.length > 0
        ? `/api/subtitles/${workId}/vtt?subtitleId=${sub.id}&lang=${encodeURIComponent(srcLang)}`
        : null);
    if (srcSrc) {
      tracks.push({ subtitleId: sub.id, lang: srcLang, label: sub.label, src: srcSrc, isDefault: sub.isDefault && tracks.length === 0 });
      addedLangs.add(srcLang);
    }

    // Translated languages
    for (const lang of Object.keys(vttKeys)) {
      if (addedLangs.has(lang)) continue;
      const src = getVttUrl(lang, vttKeys);
      if (src) {
        tracks.push({ subtitleId: sub.id, lang, label: getLangName(lang), src, isDefault: false });
        addedLangs.add(lang);
      }
    }
  }

  return NextResponse.json({ tracks });
}
