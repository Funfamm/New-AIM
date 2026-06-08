export const SUBTITLE_TARGET_LANGS = ["es", "fr", "pt", "zh", "ar", "ko", "hi"] as const;
export type SubtitleLang = (typeof SUBTITLE_TARGET_LANGS)[number];

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  zh: "Chinese",
  ar: "Arabic",
  ko: "Korean",
  hi: "Hindi",
};

export function getLangName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}
