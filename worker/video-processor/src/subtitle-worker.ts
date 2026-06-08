/**
 * Subtitle translation worker.
 * Polls /api/worker/subtitle-translation/claim for pending translation jobs.
 * Uses the API key injected by the claim route (DB pool or env fallback).
 * Reports progress and completion back to Next.js via the progress route.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { APP_BASE_URL, WORKER_SECRET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL } from "./config";

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${WORKER_SECRET}`,
});

type SubtitleSegment = { start: number; end: number; text: string };

type ClaimedSubtitleJob = {
  id: string;
  subtitleId: string;
  languages: string[];
  sourceLanguage: string;
  segments: SubtitleSegment[];
  // Key injected by claim route — decrypted DB key or env fallback
  apiKey: string | null;
  apiKeyId: string | null;
  apiKeyName: string | null;
};

// ── Gemini ────────────────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", pt: "Portuguese",
  zh: "Chinese", ar: "Arabic", ko: "Korean", hi: "Hindi",
};

function getLangName(code: string): string { return LANG_NAMES[code] ?? code.toUpperCase(); }

function callGemini(apiKey: string, prompt: string): Promise<string> {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });
  return model.generateContent(prompt).then((r) => r.response.text());
}

async function translateChunk(
  apiKey: string,
  texts: string[],
  targetLang: string,
  sourceLang: string
): Promise<string[]> {
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

  const raw = await callGemini(apiKey, prompt);
  const lines = raw.trim().split("\n").filter(Boolean);
  const translations = lines.map((l) => l.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
  if (translations.length !== texts.length) {
    throw new Error(`Translation count mismatch: expected ${texts.length}, got ${translations.length}`);
  }
  return translations;
}

async function translateSegments(
  apiKey: string,
  segments: SubtitleSegment[],
  targetLang: string,
  sourceLang: string
): Promise<SubtitleSegment[]> {
  const MAX = 500;
  const resultTexts: string[] = [];
  const texts = segments.map((s) => s.text);
  for (let i = 0; i < texts.length; i += MAX) {
    const chunk = texts.slice(i, i + MAX);
    const translated = await translateChunk(apiKey, chunk, targetLang, sourceLang);
    resultTexts.push(...translated);
  }
  return segments.map((seg, i) => ({
    start: seg.start,
    end: seg.end,
    text: resultTexts[i] ?? seg.text,
  }));
}

// ── VTT ───────────────────────────────────────────────────────────────────────

function pad(n: number, len: number): string { return String(n).padStart(len, "0"); }

function secondsToVttTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ms = Math.round((sec % 1) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(Math.floor(sec), 2)}.${pad(ms, 3)}`;
}

function segmentsToVtt(segments: SubtitleSegment[]): string {
  const cues = segments
    .map((seg, i) => `${i + 1}\n${secondsToVttTime(seg.start)} --> ${secondsToVttTime(seg.end)}\n${seg.text}`)
    .join("\n\n");
  return `WEBVTT\n\n${cues}`;
}

function hash8(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ── R2 ───────────────────────────────────────────────────────────────────────

let s3: S3Client | null = null;
function getS3(): S3Client {
  if (s3) return s3;
  s3 = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return s3;
}

async function uploadVtt(subtitleId: string, lang: string, segments: SubtitleSegment[]): Promise<string> {
  const vttContent = segmentsToVtt(segments);
  const h = hash8(vttContent + lang);
  const key = `subtitles/${subtitleId}/${lang}-${h}.vtt`;
  await getS3().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: vttContent,
      ContentType: "text/vtt",
      CacheControl: "public, max-age=86400",
    })
  );
  return key;
}

// ── Progress reporting ────────────────────────────────────────────────────────

async function reportProgress(jobId: string, apiKeyId: string | null, progress: number): Promise<void> {
  try {
    await fetch(`${APP_BASE_URL}/api/worker/subtitle-translation/progress`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ jobId, apiKeyId, status: "PROCESSING", progress }),
    });
  } catch {}
}

async function reportReady(
  jobId: string,
  apiKeyId: string | null,
  translations: Record<string, SubtitleSegment[]>,
  vttKeys: Record<string, string>
): Promise<void> {
  await fetch(`${APP_BASE_URL}/api/worker/subtitle-translation/progress`, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ jobId, apiKeyId, status: "READY", progress: 100, translations, vttKeys }),
  });
}

async function reportFailed(jobId: string, apiKeyId: string | null, error: string): Promise<void> {
  try {
    await fetch(`${APP_BASE_URL}/api/worker/subtitle-translation/progress`, {
      method: "POST",
      headers: authHeader(),
      body: JSON.stringify({ jobId, apiKeyId, status: "FAILED", error }),
    });
  } catch {}
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function processSubtitleJob(): Promise<boolean> {
  const res = await fetch(`${APP_BASE_URL}/api/worker/subtitle-translation/claim`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) {
    console.error(`[subtitle-worker] Claim returned ${res.status}`);
    return false;
  }
  const data = (await res.json()) as { job: ClaimedSubtitleJob | null };
  if (!data.job) return false;

  const { id: jobId, subtitleId, languages, sourceLanguage, segments, apiKey, apiKeyId, apiKeyName } = data.job;

  // Resolve the key — injected key takes priority, env var is the last resort
  const resolvedKey = apiKey ?? process.env.GEMINI_API_KEY ?? "";
  if (!resolvedKey) {
    console.error(`[subtitle-worker] Job ${jobId} — no Gemini API key available`);
    await reportFailed(jobId, apiKeyId, "No Gemini API key available");
    return false;
  }

  const keyLabel = apiKeyName ? `DB key "${apiKeyName}"` : "env GEMINI_API_KEY";
  console.log(`[subtitle-worker] Claimed job ${jobId} — translating to: ${languages.join(", ")} using ${keyLabel}`);

  const translations: Record<string, SubtitleSegment[]> = {};
  const vttKeys: Record<string, string> = {};

  try {
    for (let i = 0; i < languages.length; i++) {
      const lang = languages[i];
      const progress = Math.round((i / languages.length) * 90);
      await reportProgress(jobId, apiKeyId, progress);

      console.log(`[subtitle-worker] Translating to ${lang}…`);
      const translated = await translateSegments(resolvedKey, segments, lang, sourceLanguage);
      translations[lang] = translated;
      vttKeys[lang] = await uploadVtt(subtitleId, lang, translated);
      console.log(`[subtitle-worker] Done: ${lang} → ${vttKeys[lang]}`);
    }

    await reportReady(jobId, apiKeyId, translations, vttKeys);
    console.log(`[subtitle-worker] Job ${jobId} complete.`);
    return true;
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[subtitle-worker] Job ${jobId} failed: ${msg}`);
    await reportFailed(jobId, apiKeyId, msg);
    return false;
  }
}
