import type { SubtitleSegment } from "./subtitle-file-parser";
import { getTranslator } from "./translators/registry";

const MAX_SEGMENTS_PER_CALL = 500;

export async function translateTextsForLang(
  texts: string[],
  targetLang: string,
  sourceLang = "en",
  translatorName = "gemini"
): Promise<string[]> {
  const translator = getTranslator(translatorName);
  const results: string[] = [];

  for (let i = 0; i < texts.length; i += MAX_SEGMENTS_PER_CALL) {
    const chunk = texts.slice(i, i + MAX_SEGMENTS_PER_CALL);
    const { translations } = await translator.translateChunk(chunk, targetLang, sourceLang);
    results.push(...translations);
  }

  return results;
}

export async function buildTranslatedSegments(
  segments: SubtitleSegment[],
  targetLang: string,
  sourceLang = "en"
): Promise<SubtitleSegment[]> {
  const texts = segments.map((s) => s.text);
  const translated = await translateTextsForLang(texts, targetLang, sourceLang);
  return segments.map((seg, i) => ({
    start: seg.start,
    end: seg.end,
    text: translated[i] ?? seg.text,
  }));
}
