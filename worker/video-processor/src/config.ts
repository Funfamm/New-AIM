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
