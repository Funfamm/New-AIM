import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.resolve(__dirname, "../.env") });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const APP_BASE_URL = requireEnv("APP_BASE_URL").replace(/\/$/, "");

// Support both WORKER_SHARED_SECRET (preferred) and legacy WORKER_SECRET
const _workerSecret = process.env.WORKER_SHARED_SECRET ?? process.env.WORKER_SECRET;
if (!_workerSecret) throw new Error("Missing WORKER_SHARED_SECRET or WORKER_SECRET in .env");
export const WORKER_SECRET = _workerSecret;
export const WORKER_PORT   = parseInt(process.env.WORKER_PORT ?? "4242", 10);

export const R2_ACCOUNT_ID       = requireEnv("R2_ACCOUNT_ID");
export const R2_ACCESS_KEY_ID    = requireEnv("R2_ACCESS_KEY_ID");
export const R2_SECRET_ACCESS_KEY = requireEnv("R2_SECRET_ACCESS_KEY");
export const R2_BUCKET_NAME      = requireEnv("R2_BUCKET_NAME");
export const R2_PUBLIC_BASE_URL  = requireEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");

// Gemini model — override via GEMINI_MODEL env var if a newer model is available
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Transcription endpoint (ngrok URL for local dev, stable URL in production)
export const TRANSCRIPTION_ENDPOINT = (process.env.TRANSCRIPTION_ENDPOINT || "").replace(/\/$/, "");
// Optional Bearer token sent to the transcription endpoint
export const TRANSCRIPTION_SECRET = process.env.TRANSCRIPTION_SECRET || "";

// Active transcription provider:
//   1. TRANSCRIPTION_PROVIDER env var if explicitly set to "whisper" or "gemini"
//   2. "whisper" if TRANSCRIPTION_ENDPOINT is configured (auto-detect)
//   3. "" — not configured; worker will fail with a descriptive error at job time
//   Note: never defaults to "gemini" silently — Gemini is for translation only.
export const TRANSCRIPTION_PROVIDER: "whisper" | "gemini" | "" =
  process.env.TRANSCRIPTION_PROVIDER === "whisper" ? "whisper" :
  process.env.TRANSCRIPTION_PROVIDER === "gemini"  ? "gemini"  :
  TRANSCRIPTION_ENDPOINT                           ? "whisper" : "";

// Optional fallback provider when primary fails. Set to "gemini" to auto-retry with Gemini
// when the whisper endpoint is unreachable or returns an error.
export const TRANSCRIPTION_FALLBACK_PROVIDER: "gemini" | "" =
  (process.env.TRANSCRIPTION_FALLBACK_PROVIDER as "gemini" | "") || "";
