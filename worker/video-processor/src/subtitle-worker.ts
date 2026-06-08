/**
 * Subtitle worker.
 * Handles two job types:
 *   "translate"  — translates existing source segments into target languages
 *   "transcribe" — transcribes video audio into source subtitle segments via Gemini
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { APP_BASE_URL, WORKER_SECRET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL, GEMINI_MODEL } from "./config";

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
  const fileContent = fs.readFileSync(filePath);
  const fileSize = fileContent.length;

  // Initiate resumable upload
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": fileSize.toString(),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: "subtitle_transcription" } }),
    }
  );

  const uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) throw new Error("Failed to initiate Gemini file upload");

  // Upload file content
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": fileSize.toString(),
      "Content-Type": mimeType,
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: fileContent,
  });

  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => "");
    throw new Error(`Gemini file upload failed: ${uploadRes.status} ${txt}`);
  }

  const fileData = await uploadRes.json() as { file?: { uri?: string; name?: string }; uri?: string };
  const uri = fileData.file?.uri ?? (fileData as Record<string, unknown>).uri as string | undefined;
  if (!uri) throw new Error("Gemini file upload returned no URI");
  return uri;
}

async function waitForFileActive(apiKey: string, fileUri: string, maxWaitMs = 60000): Promise<void> {
  const start = Date.now();
  // Extract file name from URI: e.g. "files/abc123"
  const fileName = fileUri.split("/").slice(-2).join("/");
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
    );
    if (!res.ok) break;
    const data = await res.json() as { state?: string };
    if (data.state === "ACTIVE") return;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function transcribeVideo(
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
  if (!resolvedKey) {
    console.error(`[subtitle-worker] Job ${jobId} — no Gemini API key available`);
    await reportFailed(jobId, apiKeyId, "No Gemini API key available");
    return false;
  }

  const keyLabel = apiKeyName ? `DB key "${apiKeyName}"` : "env GEMINI_API_KEY";

  // ── Transcription job ──────────────────────────────────────────────────────
  if (data.job.type === "transcribe") {
    const { subtitleId, videoUrl, sourceLanguage } = data.job;
    console.log(`[subtitle-worker] Claimed transcription job ${jobId} for ${videoUrl} using ${keyLabel}`);

    try {
      const segments = await transcribeVideo(resolvedKey, videoUrl, sourceLanguage, async (pct) => {
        await reportProgress(jobId, apiKeyId, pct);
      });

      if (segments.length === 0) {
        throw new Error("No dialogue detected in video — the video may have no speech or only music.");
      }

      await reportReadyTranscription(jobId, apiKeyId, segments);
      console.log(`[subtitle-worker] Transcription job ${jobId} complete: ${segments.length} cues`);
      return true;
    } catch (err) {
      const msg = normalizeGeminiError(err);
      console.error(`[subtitle-worker] Transcription job ${jobId} failed: ${msg}`);
      await reportFailed(jobId, apiKeyId, msg);
      return false;
    }
  }

  // ── Translation job ───────────────────────────────────────────────────────
  const { subtitleId, languages, sourceLanguage, segments } = data.job;
  console.log(`[subtitle-worker] Claimed translation job ${jobId} — translating to: ${languages.join(", ")} using ${keyLabel}`);

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
