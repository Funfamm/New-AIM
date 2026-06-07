import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";

const WORKER_URL = (process.env.WORKER_URL ?? "http://127.0.0.1:4242").replace(/\/$/, "");

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const res = await fetch(`${WORKER_URL}/run`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Worker HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Worker unreachable — run: cd worker/video-processor && npm run serve" },
      { status: 503 },
    );
  }
}
