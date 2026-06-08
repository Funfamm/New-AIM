import type { ITranslator } from "../interfaces/ITranslator";
import { GeminiTranslator } from "./GeminiTranslator";

const registry = new Map<string, ITranslator>();

export function registerTranslator(name: string, translator: ITranslator): void {
  registry.set(name, translator);
}

export function getTranslator(name = "gemini"): ITranslator {
  if (!registry.has(name)) {
    if (name === "gemini") {
      registry.set("gemini", new GeminiTranslator());
    } else {
      throw new Error(`No translator registered for: ${name}`);
    }
  }
  return registry.get(name)!;
}
