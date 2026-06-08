/**
 * Subtitle worker.
 * Handles two job types:
 *   "transcribe" — transcribes video audio using faster-whisper (primary) or Gemini (fallback)
 *   "translate"  — translates source segments into target languages using Gemini
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  APP_BASE_URL, WORKER_SECRET,
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL,
  GEMINI_MODEL,
  TRANSCRIPTION_PROVIDER, TRANSCRIPTION_ENDPOINT, TRANSCRIPTION_SECRET, TRANSCRIPTION_FALLBACK_PROVIDER,
} from "./config";

void R2_PUBLIC_BASE_URL; // referenced in config, used by other parts of worker

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${WORKER_SECRET}`,
});

type SubtitleSegment = { start: number; end: number; text: string };

type ClaimedJob =
  | {
      id: string;
      type: "translate";
      subtitleId: string;
      languages: string[];
      sourceLanguage: string;
      segments: SubtitleSegment[];
      apiKey: string | null;
      apiKeyId: string | null;
      apiKeyName: string | null;
    }
  | {
      id: string;
      type: "transcribe";
      subtitleId: string;
      workId: string;
      mediaType: string;
      sourceLanguage: string;
      videoUrl: string;
      apiKey: string | null;
      apiKeyId: string | null;
      apiKeyName: string | null;
    };

// ── Gemini ────────────────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  pt: "Portuguese", ru: "Russian", zh: "Chinese", ar: "Arabic",
  ja: "Japanese", ko: "Korean", hi: "Hindi",
};

function getLangName(code: string): string { return LANG_NAMES[code] ?? code.toUpperCase(); }

function callGemini(apiKey: string, prompt: string): Promise<string> {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: GEMINI_MODEL });
  return model.generateContent(prompt).then((r) => r.response.text());
}

function normalizeGeminiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("404") || msg.includes("is not found") || msg.toLowerCase().includes("model not found")) {
    return `Gemini model "${GEMINI_MODEL}" is not available. Update GEMINI_MODEL in worker .env to a supported model (e.g. gemini-2.5-flash).`;
  }
  return msg;
}

// ── Translation ───────────────────────────────────────────────────────────────

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

// ── Transcription ─────────────────────────────────────────────────────────────

function parseSrtToSegments(srt: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const blocks = srt.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    // Find the timecode line (HH:MM:SS,mmm --> HH:MM:SS,mmm)
    const tcIdx = lines.findIndex((l) => l.includes(" --> "));
    if (tcIdx < 0) continue;
    const [startStr, endStr] = lines[tcIdx].split(" --> ");
    const parseTime = (t: string): number => {
      const clean = t.trim().replace(",", ".");
      const parts = clean.split(":");
      if (parts.length !== 3) return 0;
      const h = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      const s = parseFloat(parts[2]);
      return h * 3600 + m * 60 + s;
    };
    const start = parseTime(startStr);
    const end = parseTime(endStr);
    const text = lines.slice(tcIdx + 1).join(" ").trim();
    if (text && end > start) {
      segments.push({ start, end, text });
    }
  }
  return segments;
}

async function downloadToTemp(url: string): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `aim-transcribe-${Date.now()}.mp4`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to download video: ${res.status}`);

  const writer = fs.createWriteStream(tmpPath);
  const reader = res.body.getReader();

  await new Promise<void>((resolve, reject) => {
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { writer.end(); break; }
        if (!writer.write(value)) await new Promise<void>((r) => writer.once("drain", r));
      }
    };
    pump().then(resolve).catch(reject);
    writer.once("error", reject);
  });

  return tmpPath;
}

async function uploadFileToGemini(apiKey: string, filePath: string, mimeType: string): Promise<string> {
  const fileManager = new GoogleAIFileManager(apiKey);
  const stat = fs.statSync(filePath);
  console.log(`[subtitle-worker] Uploading ${path.basename(filePath)} (${(stat.size / 1024 / 1024).toFixed(1)} MB) to Gemini Files API, model=${GEMINI_MODEL}`);

  try {
    const result = await fileManager.uploadFile(filePath, { mimeType, displayName: "subtitle_transcription" });
    console.log(`[subtitle-worker] Gemini upload complete: ${result.file.name}, state=${result.file.state}`);
    return result.file.uri;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[subtitle-worker] Gemini file upload error: ${msg}`);
    throw new Error("Gemini file upload failed during transcription setup. Check worker logs for provider response.");
  }
}

async function waitForFileActive(apiKey: string, fileUri: string, maxWaitMs = 120_000): Promise<void> {
  const fileManager = new GoogleAIFileManager(apiKey);
  const match = fileUri.match(/files\/[^/?]+/);
  if (!match) throw new Error(`Cannot parse file name from Gemini URI: ${fileUri}`);
  const fileName = match[0];

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const file = await fileManager.getFile(fileName);
    if (file.state === FileState.ACTIVE) return;
    if (file.state === FileState.FAILED) throw new Error(`Gemini file processing failed: ${fileName}`);
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new Error("Gemini file took too long to become ACTIVE — transcription timed out after 2 minutes");
}

async function transcribeViaWhisper(
  videoUrl: string,
  sourceLanguage: string,
  mediaType: string,
  workId: string,
  onProgress: (pct: number) => void
): Promise<SubtitleSegment[]> {
  if (!TRANSCRIPTION_ENDPOINT) {
    throw new Error(
      "Whisper transcription endpoint is not configured. " +
      "Set TRANSCRIPTION_ENDPOINT in worker .env, or change TRANSCRIPTION_PROVIDER to gemini."
    );
  }

  console.log(`[subtitle-worker] Whisper transcription → ${TRANSCRIPTION_ENDPOINT} | mediaType=${mediaType}`);
  onProgress(10);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TRANSCRIPTION_SECRET) headers["Authorization"] = `Bearer ${TRANSCRIPTION_SECRET}`;

  let res: Response;
  try {
    res = await fetch(`${TRANSCRIPTION_ENDPOINT}/transcribe`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: videoUrl, language: sourceLanguage, mediaType, workId }),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Whisper transcription service is unreachable. ` +
      `Check that TRANSCRIPTION_ENDPOINT (${TRANSCRIPTION_ENDPOINT}) is running and accessible. ` +
      `Detail: ${detail}`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404) {
      throw new Error(
        `Whisper endpoint was reached but /transcribe was not found (404). ` +
        `Restart the Python server with the latest main.py that includes @app.post("/transcribe"). ` +
        `Endpoint: ${TRANSCRIPTION_ENDPOINT}/transcribe`
      );
    }
    if (res.status === 401) {
      throw new Error(
        `Whisper endpoint rejected the request (401 Unauthorized). ` +
        `Check that TRANSCRIPTION_SECRET in worker .env matches the Python server's TRANSCRIPTION_SECRET.`
      );
    }
    throw new Error(`Whisper transcription failed: endpoint returned ${res.status}. ${body.slice(0, 300)}`);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new Error("Whisper transcription failed: endpoint returned non-JSON response.");
  }

  const data = payload as { segments?: unknown };
  if (!Array.isArray(data.segments) || (data.segments as unknown[]).length === 0) {
    throw new Error(
      "Whisper transcription failed: invalid segment response. " +
      "Expected { segments: [{start, end, text}] } but got an unexpected format."
    );
  }

  console.log(`[subtitle-worker] Whisper returned ${(data.segments as unknown[]).length} segments`);
  onProgress(90);
  return data.segments as SubtitleSegment[];
}

async function transcribeViaGemini(
  apiKey: string,
  videoUrl: string,
  sourceLanguage: string,
  onProgress: (pct: number) => void
): Promise<SubtitleSegment[]> {
  onProgress(5);
  const tmpPath = await downloadToTemp(videoUrl);
  onProgress(30);

  let fileUri: string;
  try {
    fileUri = await uploadFileToGemini(apiKey, tmpPath, "video/mp4");
    onProgress(50);
    await waitForFileActive(apiKey, fileUri);
    onProgress(60);
  } finally {
    fs.unlink(tmpPath, () => {});
  }

  const langName = getLangName(sourceLanguage);
  const prompt = `Transcribe all spoken ${langName} dialogue in this video into SRT subtitle format.

Requirements:
- Use standard SRT format: cue number, then timestamp line (HH:MM:SS,mmm --> HH:MM:SS,mmm), then text
- Include ONLY spoken dialogue — no sound descriptions, music notes, or stage directions
- Break long lines at natural pauses, max ~42 characters per line
- Each cue should be max 2 lines
- Be precise with timestamps — sync to when words are actually spoken
- Keep the original ${langName} language (do not translate)
- If there is no dialogue, return an empty response

Return ONLY the SRT content, nothing else.`;

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await model.generateContent([
    { fileData: { mimeType: "video/mp4", fileUri } },
    { text: prompt },
  ]);

  onProgress(90);
  const srtText = result.response.text().trim();
  if (!srtText) return [];

  return parseSrtToSegments(srtText);
}

async function transcribeVideo(
  apiKey: string,
  videoUrl: string,
  sourceLanguage: string,
  mediaType: string,
  workId: string,
  onProgress: (pct: number) => void
): Promise<SubtitleSegment[]> {
  console.log(`[subtitle-worker] Transcription provider: ${TRANSCRIPTION_PROVIDER || "(not configured)"}`);

  if (!TRANSCRIPTION_PROVIDER) {
    throw new Error(
      "Whisper transcription is not configured. " +
      "Set TRANSCRIPTION_PROVIDER=whisper and TRANSCRIPTION_ENDPOINT in worker .env."
    );
  }

  if (TRANSCRIPTION_PROVIDER === "whisper") {
    try {
      return await transcribeViaWhisper(videoUrl, sourceLanguage, mediaType, workId, onProgress);
    } catch (whisperErr) {
      const whisperMsg = whisperErr instanceof Error ? whisperErr.message : String(whisperErr);
      if (TRANSCRIPTION_FALLBACK_PROVIDER === "gemini" && apiKey) {
        console.warn(`[subtitle-worker] Whisper failed — falling back to Gemini. Whisper error: ${whisperMsg}`);
        onProgress(5);
        return transcribeViaGemini(apiKey, videoUrl, sourceLanguage, onProgress);
      }
      throw whisperErr;
    }
  }

  // Gemini primary path
  return transcribeViaGemini(apiKey, videoUrl, sourceLanguage, onProgress);
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

async function reportReadyTranslation(
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

async function reportReadyTranscription(
  jobId: string,
  apiKeyId: string | null,
  segments: SubtitleSegment[]
): Promise<void> {
  await fetch(`${APP_BASE_URL}/api/worker/subtitle-translation/progress`, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ jobId, apiKeyId, status: "READY", progress: 100, segments }),
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
  const data = (await res.json()) as { job: ClaimedJob | null };
  if (!data.job) return false;

  const { id: jobId, apiKey, apiKeyId, apiKeyName } = data.job;
  const resolvedKey = apiKey ?? process.env.GEMINI_API_KEY ?? "";
  const keyLabel = apiKeyName ? `DB key "${apiKeyName}"` : (resolvedKey ? "env GEMINI_API_KEY" : "none");

  // ── Transcription job ──────────────────────────────────────────────────────
  if (data.job.type === "transcribe") {
    const { subtitleId, workId, mediaType, videoUrl, sourceLanguage } = data.job;

    // Gemini key is required only when transcribing via Gemini (primary or fallback)
    const needsKeyForTranscription =
      TRANSCRIPTION_PROVIDER === "gemini" ||
      (TRANSCRIPTION_PROVIDER === "whisper" && TRANSCRIPTION_FALLBACK_PROVIDER === "gemini");
    if (needsKeyForTranscription && !resolvedKey) {
      console.error(`[subtitle-worker] Job ${jobId} — Gemini key required for transcription provider="${TRANSCRIPTION_PROVIDER}" but none available`);
      await reportFailed(jobId, apiKeyId, "No Gemini API key available. Add a key in Settings or set GEMINI_API_KEY in worker .env.");
      return false;
    }

    console.log(`[subtitle-worker] Claimed transcription job ${jobId} | provider=${TRANSCRIPTION_PROVIDER} | mediaType=${mediaType} | key=${keyLabel}`);

    try {
      const segments = await transcribeVideo(resolvedKey, videoUrl, sourceLanguage, mediaType, workId, async (pct) => {
        await reportProgress(jobId, apiKeyId, pct);
      });

      if (segments.length === 0) {
        throw new Error("No dialogue detected in video — the video may have no speech or only music.");
      }

      await reportReadyTranscription(jobId, apiKeyId, segments);
      console.log(`[subtitle-worker] Transcription job ${jobId} complete: ${segments.length} cues`);
      return true;
    } catch (err) {
      // Use plain message — transcription errors are Whisper/config errors, not Gemini errors
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[subtitle-worker] Transcription job ${jobId} failed: ${msg}`);
      await reportFailed(jobId, apiKeyId, msg);
      return false;
    }
  }

  // ── Translation job ───────────────────────────────────────────────────────
  if (!resolvedKey) {
    console.error(`[subtitle-worker] Translation job ${jobId} — no Gemini API key available`);
    await reportFailed(jobId, apiKeyId, "No Gemini API key available for translation. Add a key in Settings.");
    return false;
  }

  const { subtitleId, languages, sourceLanguage, segments } = data.job;
  console.log(`[subtitle-worker] Claimed translation job ${jobId} — langs: ${languages.join(", ")} | key=${keyLabel}`);

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

    await reportReadyTranslation(jobId, apiKeyId, translations, vttKeys);
    console.log(`[subtitle-worker] Translation job ${jobId} complete.`);
    return true;
  } catch (err) {
    const msg = normalizeGeminiError(err);
    console.error(`[subtitle-worker] Translation job ${jobId} failed: ${msg}`);
    await reportFailed(jobId, apiKeyId, msg);
    return false;
  }
}
