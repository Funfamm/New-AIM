import { type NextRequest, NextResponse } from "next/server";
import { recordEmailClick, safeRedirectUrl } from "@/lib/email-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token  = req.nextUrl.searchParams.get("t");
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "/";

  const destination = safeRedirectUrl(rawUrl);

  if (token) {
    await recordEmailClick(token);
  }

  return NextResponse.redirect(new URL(destination, req.nextUrl.origin), 302);
}
