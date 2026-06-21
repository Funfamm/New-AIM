export const SUBTITLE_TARGET_LANGS = ["es", "fr", "de", "pt", "ru", "zh", "ar", "ja", "ko", "hi"] as const;
export type SubtitleLang = (typeof SUBTITLE_TARGET_LANGS)[number];

export const LANGUAGE_NAMES: Record<string, string> = {
  auto:  "Auto Detect",
  mixed: "Original / Mixed",
  en:    "English",
  es:    "Spanish",
  fr:    "French",
  de:    "German",
  pt:    "Portuguese",
  ru:    "Russian",
  zh:    "Chinese",
  ar:    "Arabic",
  ja:    "Japanese",
  ko:    "Korean",
  hi:    "Hindi",
};

// Ordered list for source language selectors in admin UI
export const SOURCE_LANG_OPTIONS = [
  { value: "auto",  label: "Auto Detect" },
  { value: "en",    label: "English" },
  { value: "es",    label: "Spanish" },
  { value: "fr",    label: "French" },
  { value: "de",    label: "German" },
  { value: "pt",    label: "Portuguese" },
  { value: "ar",    label: "Arabic" },
  { value: "ko",    label: "Korean" },
  { value: "hi",    label: "Hindi" },
  { value: "zh",    label: "Chinese" },
  { value: "ru",    label: "Russian" },
  { value: "ja",    label: "Japanese" },
  { value: "mixed", label: "Mixed / Multiple Languages" },
];

export function getLangName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

// Returns the list of languages available as translation targets for a given source.
// - source = "en"    → all 10 SUBTITLE_TARGET_LANGS (English excluded — it IS the source)
// - source = "es"    → 10 SUBTITLE_TARGET_LANGS + "en" (English is now a valid target)
// - source = "auto"  → all 11 langs (auto-detected source, English included)
// - source = "mixed" → all 11 langs (multi-language source, English included)
export function getTargetLangs(sourceLang: string): string[] {
  const withEnglish = [...SUBTITLE_TARGET_LANGS, "en"];
  if (!sourceLang || sourceLang === "auto" || sourceLang === "mixed") {
    return withEnglish;
  }
  return withEnglish.filter((l) => l !== sourceLang);
}
