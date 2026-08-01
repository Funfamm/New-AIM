import type { ITranslator, TranslationResult } from "../interfaces/ITranslator";
import { callGemini } from "../gemini";
import { getLangName } from "../subtitle-languages";

export class GeminiTranslator implements ITranslator {
  async translateChunk(
    texts: string[],
    targetLang: string,
    sourceLang = "en"
  ): Promise<TranslationResult> {
    const targetName = getLangName(targetLang);
    const sourceName = getLangName(sourceLang);

    const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
    const prompt = `You are a professional subtitle translator.
Translate the following ${sourceName} subtitle lines to ${targetName}.
Rules:
- Keep the same line count and numbering
- Preserve timing cues and character names
- Use natural spoken language appropriate for film subtitles
- Return ONLY the translated lines, numbered exactly as given
- Do not add explanations or extra text

${numbered}`;

    const raw = await callGemini(prompt);
    const lines = raw.trim().split("\n").filter(Boolean);
    const translations = lines
      .map((l) => l.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean);

    if (translations.length !== texts.length) {
      throw new Error(
        `Translation count mismatch: expected ${texts.length}, got ${translations.length}`
      );
    }

    return { translations };
  }
}
