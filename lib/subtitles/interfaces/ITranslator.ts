export type TranslationResult = {
  translations: string[];
  keyLabel?: string;
};

export interface ITranslator {
  translateChunk(
    texts: string[],
    targetLang: string,
    sourceLang?: string
  ): Promise<TranslationResult>;
}
