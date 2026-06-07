import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";

const WORKER_URL = (process.env.WORKER_URL ?? "http://127.0.0.1:4242").replace(/\/$/, "");

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const res = await fetch(`${WORKER_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`Worker HTTP ${res.status}`);
    const data = await res.json() as { status: string; busy: boolean; uptime: number };
    return NextResponse.json({ online: true, busy: data.busy, uptime: data.uptime });
  } catch {
    return NextResponse.json({ online: false });
  }
}
