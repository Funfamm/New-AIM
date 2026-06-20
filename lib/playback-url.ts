import "server-only";
import { signPlaybackToken } from "@/lib/playback-token";

/**
 * Turns a stored public R2 video URL into a gated, tokenised URL served by the
 * Cloudflare playback Worker (see docs/lite-playback-gate-plan.md).
 *
 * Returns the original URL unchanged — i.e. no behaviour change — when:
 *   • the gate is not configured (PLAYBACK_GATE_BASE_URL / PLAYBACK_SIGNING_KEY unset), or
 *   • the URL is not an R2 public URL we can derive a key from (e.g. YouTube/Vimeo).
 *
 * The token authorises the entire HLS folder (master + variants + segments) for a few
 * hours; the Worker propagates the same token onto child playlist entries.
 *
 * Only call this for content that should be gated (a work where requiresAuth is true).
 * Trailers/previews are intentionally left public and must not be passed here.
 */
export function resolvePlaybackUrl(rawUrl: string): string {
  const gateBase   = process.env.PLAYBACK_GATE_BASE_URL?.replace(/\/$/, "");
  const publicBase = (process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

  if (!gateBase || !publicBase || !rawUrl.startsWith(publicBase + "/")) return rawUrl;

  const key      = rawUrl.slice(publicBase.length + 1);   // works/the-film/hls/master.m3u8
  const slashIdx = key.lastIndexOf("/");
  const prefix   = slashIdx >= 0 ? key.slice(0, slashIdx + 1) : ""; // works/the-film/hls/

  const token = signPlaybackToken(prefix);
  if (!token) return rawUrl;

  return `${gateBase}/${key}?token=${encodeURIComponent(token)}`;
}
