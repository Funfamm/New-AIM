export const SUBTITLE_TARGET_LANGS = ["es", "fr", "de", "pt", "ru", "zh", "ar", "ja", "ko", "hi"] as const;
export type SubtitleLang = (typeof SUBTITLE_TARGET_LANGS)[number];

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Chinese",
  ar: "Arabic",
  ja: "Japanese",
  ko: "Korean",
  hi: "Hindi",
};

export function getLangName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}
