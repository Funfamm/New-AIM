import http from "http";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";

const WORKER_URL = (process.env.WORKER_URL ?? "http://127.0.0.1:4242").replace(/\/$/, "");

function httpPost(url: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST" }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => resolve(body));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await httpPost(`${WORKER_URL}/run`);
    return NextResponse.json(JSON.parse(body));
  } catch {
    return NextResponse.json(
      { error: "Worker unreachable — run: cd worker/video-processor && npm run serve" },
      { status: 503 },
    );
  }
}
