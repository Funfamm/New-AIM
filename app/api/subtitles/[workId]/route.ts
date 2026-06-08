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

    // Source language VTT (if present as key "en" or sourceLanguage)
    const srcLangKey = sub.sourceLanguage;
    const srcVttKey = vttKeys[srcLangKey];
    if (srcVttKey) {
      try {
        const src = getVttUrl(srcLangKey, vttKeys)!;
        tracks.push({
          subtitleId: sub.id,
          lang: sub.sourceLanguage,
          label: sub.label,
          src,
          isDefault: sub.isDefault && tracks.length === 0,
        });
      } catch {}
    }

    // All translated languages
    const translationKeys = Object.keys(vttKeys).filter((k) => k !== srcLangKey);
    for (const lang of translationKeys) {
      try {
        const src = getVttUrl(lang, vttKeys)!;
        tracks.push({
          subtitleId: sub.id,
          lang,
          label: getLangName(lang),
          src,
          isDefault: false,
        });
      } catch {}
    }
  }

  return NextResponse.json({ tracks });
}
