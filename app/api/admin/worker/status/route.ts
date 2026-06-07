import http from "http";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";

const WORKER_URL = (process.env.WORKER_URL ?? "http://127.0.0.1:4242").replace(/\/$/, "");

function httpGet(url: string, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => resolve(body));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
  });
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await httpGet(`${WORKER_URL}/health`);
    const data = JSON.parse(body) as { status: string; busy: boolean; uptime: number };
    return NextResponse.json({ online: true, busy: data.busy, uptime: data.uptime });
  } catch {
    return NextResponse.json({ online: false });
  }
}
