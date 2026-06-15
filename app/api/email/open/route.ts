import { type NextRequest, NextResponse } from "next/server";
import { PIXEL_GIF, recordEmailOpen } from "@/lib/email-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  if (token) {
    await recordEmailOpen(token);
  }

  return new NextResponse(PIXEL_GIF, {
    status: 200,
    headers: {
      "Content-Type":  "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma":        "no-cache",
    },
  });
}
