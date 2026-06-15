// Email open + click tracking.
// Open:  1×1 pixel injected before </body>; GET /api/email/open?t=<token>
// Click: internal links wrapped with redirect; GET /api/email/click?t=<token>&url=<encoded>
// Both use the same trackingToken stored on the EmailLog row.

import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// 1×1 transparent GIF
export const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export function generateTrackingToken(): string {
  return crypto.randomUUID();
}

// ── Open tracking ──────────────────────────────────────────────

export function injectTrackingPixel(html: string, token: string): string {
  const pixelUrl = `${APP_URL}/api/email/open?t=${encodeURIComponent(token)}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;outline:0;" />`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${pixel}</body>`);
  }
  return html + pixel;
}

export async function recordEmailOpen(token: string): Promise<void> {
  try {
    await prisma.emailLog.updateMany({
      where: { trackingToken: token, openedAt: null },
      data:  { openedAt: new Date() },
    });
  } catch {
    // tracking must never throw
  }
}

// ── Click tracking ─────────────────────────────────────────────

// Wraps every internal <a href> in an email with the click-tracking redirect URL.
// Only wraps links that start with APP_URL or "/" (relative) to avoid open redirect risk.
export function wrapLinksWithTracking(html: string, token: string): string {
  const clickBase = `${APP_URL}/api/email/click?t=${encodeURIComponent(token)}&url=`;

  return html.replace(/(<a\s[^>]*href=")([^"]+)(")/gi, (match, open, href, close) => {
    const isInternal =
      href.startsWith("/") ||
      href.startsWith(APP_URL);
    if (!isInternal) return match; // external links (YouTube, etc.) — skip tracking
    const encoded = encodeURIComponent(href);
    return `${open}${clickBase}${encoded}${close}`;
  });
}

export async function recordEmailClick(token: string): Promise<void> {
  try {
    await prisma.emailLog.updateMany({
      where: { trackingToken: token, clickedAt: null },
      data:  { clickedAt: new Date() },
    });
  } catch {
    // tracking must never throw
  }
}

// Returns a safe redirect target — only accepts relative paths or same-origin URLs.
export function safeRedirectUrl(raw: string): string {
  if (raw.startsWith("/")) return raw;
  try {
    const parsed = new URL(raw);
    const appOrigin = new URL(APP_URL).origin;
    if (parsed.origin === appOrigin) return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    // fall through
  }
  return "/"; // fallback to home on invalid or cross-origin URL
}
