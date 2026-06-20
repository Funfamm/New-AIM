/**
 * AIM Studio — Playback Gate Worker
 *
 * Sits in front of the R2 bucket (via binding) and only serves film objects to
 * requests carrying a valid, unexpired, path-scoped token issued by the Next.js
 * watch page (`lib/playback-token.ts`). No/invalid/expired token → redirect to the
 * platform. For `.m3u8` playlists it appends the same token to every child entry so
 * segment requests stay authorised.
 *
 * Token format (must match lib/playback-token.ts):
 *   base64url("<exp>:<prefix>") + "." + base64url(HMAC-SHA256(payload, PLAYBACK_SIGNING_KEY))
 */

export interface Env {
  BUCKET: R2Bucket;
  PLAYBACK_SIGNING_KEY: string;
  /** App origin people are bounced to when a token is missing/invalid, e.g. https://impactaistudio.com */
  WATCH_REDIRECT_BASE: string;
  /** Origin allowed to fetch (CORS), e.g. https://impactaistudio.com */
  ALLOWED_ORIGIN: string;
}

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns the signed prefix if the token is valid and unexpired, else null. */
async function verifyToken(token: string, key: CryptoKey): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;

  const payloadB64 = token.slice(0, dot);
  const sigB64     = token.slice(dot + 1);

  let payload: string;
  try {
    payload = new TextDecoder().decode(b64urlToBytes(payloadB64));
  } catch {
    return null;
  }

  const expected = bytesToB64url(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  );
  if (!timingSafeEqual(expected, sigB64)) return null;

  const colon = payload.indexOf(":");
  if (colon < 0) return null;
  const exp    = Number(payload.slice(0, colon));
  const prefix = payload.slice(colon + 1);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  return prefix;
}

/** Append ?token=/&token= to a playlist URI, leaving comments/tags untouched. */
function withToken(uri: string, token: string): string {
  const sep = uri.includes("?") ? "&" : "?";
  return `${uri}${sep}token=${encodeURIComponent(token)}`;
}

/** Rewrite an HLS playlist so every segment / child-playlist entry carries the token. */
function rewritePlaylist(body: string, token: string): string {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return line;
      if (trimmed.startsWith("#")) {
        // Rewrite URIs embedded in tag attributes (EXT-X-MEDIA, EXT-X-MAP, etc.)
        return line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${withToken(uri, token)}"`);
      }
      // A bare line is a segment or child-playlist URI.
      return withToken(trimmed, token);
    })
    .join("\n");
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: cors });
    }

    const url   = new URL(request.url);
    const key   = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const token = url.searchParams.get("token");

    const bounce = () =>
      Response.redirect(env.WATCH_REDIRECT_BASE || "/", 302);

    if (!key || !token) return bounce();

    const signingKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.PLAYBACK_SIGNING_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const prefix = await verifyToken(token, signingKey);
    if (prefix === null || !key.startsWith(prefix)) return bounce();

    // ── Playlist: rewrite child URIs to carry the token ──────────────────────
    if (key.endsWith(".m3u8")) {
      const obj = await env.BUCKET.get(key);
      if (!obj) return new Response("Not found", { status: 404, headers: cors });
      const rewritten = rewritePlaylist(await obj.text(), token);
      return new Response(rewritten, {
        headers: {
          ...cors,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store", // playlists carry short-lived tokens
        },
      });
    }

    // ── Binary (segments / mp4): stream with Range support ───────────────────
    const range = request.headers.get("range");
    const rangeMatch = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;

    if (rangeMatch) {
      const start = rangeMatch[1] ? Number(rangeMatch[1]) : undefined;
      const end   = rangeMatch[2] ? Number(rangeMatch[2]) : undefined;
      const offset = start ?? 0;
      const length = end !== undefined ? end - offset + 1 : undefined;

      const obj = await env.BUCKET.get(key, { range: { offset, length } });
      if (!obj) return new Response("Not found", { status: 404, headers: cors });

      const headers = new Headers(cors);
      obj.writeHttpMetadata(headers);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "private, max-age=31536000, immutable");
      const total = obj.size;
      const last  = end !== undefined ? end : total - 1;
      headers.set("Content-Range", `bytes ${offset}-${last}/${total}`);
      headers.set("Content-Length", String(last - offset + 1));
      if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

      return new Response(request.method === "HEAD" ? null : obj.body, { status: 206, headers });
    }

    const obj = await env.BUCKET.get(key);
    if (!obj) return new Response("Not found", { status: 404, headers: cors });

    const headers = new Headers(cors);
    obj.writeHttpMetadata(headers);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=31536000, immutable");
    headers.set("Content-Length", String(obj.size));
    if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

    return new Response(request.method === "HEAD" ? null : obj.body, { status: 200, headers });
  },
};
