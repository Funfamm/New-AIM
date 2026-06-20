import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// ── Image host allowlist ──────────────────────────────────────────────
// Closed allowlist instead of a wildcard so the Next.js image optimizer
// cannot be used as an SSRF/abuse proxy for arbitrary external hosts.
// The R2 public host is derived from the configured base URL so this
// always matches whatever CDN domain is in use, plus the static hosts
// the app actually loads images from (Google OAuth avatars, R2 dev URLs).
function r2ImageHost(): { protocol: "https"; hostname: string } | null {
  const base = process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || "";
  if (!base) return null;
  try {
    return { protocol: "https", hostname: new URL(base).hostname };
  } catch {
    return null;
  }
}

const imageRemotePatterns = [
  r2ImageHost(),
  { protocol: "https" as const, hostname: "*.r2.dev" },
  { protocol: "https" as const, hostname: "*.r2.cloudflarestorage.com" },
  { protocol: "https" as const, hostname: "lh3.googleusercontent.com" }, // Google OAuth avatars
].filter((p): p is { protocol: "https"; hostname: string } => p !== null);

const securityHeaders = [
  // Clickjacking protection — no iframing of AIM Studio pages
  { key: "X-Frame-Options",        value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer leakage across origins
  { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
  // Restrict browser feature APIs
  { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HSTS — enforce HTTPS for 2 years (only meaningful in production behind HTTPS)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline for hydration scripts. unsafe-eval is only
      // needed by the dev-mode React Refresh runtime — it is dropped in production
      // so an injected payload cannot use eval()/new Function() to execute.
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      // Tailwind uses inline styles. Fonts are self-hosted via next/font, so no
      // external Google Fonts origins are required.
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      // Images from R2 CDN + data URIs + blob for video thumbnails
      "img-src 'self' data: blob: https:",
      // HLS video segments from R2 CDN
      "media-src 'self' blob: https:",
      // API fetches — allow all HTTPS (Graph, ACS, analytics)
      "connect-src 'self' https: wss:",
      // No iframes allowed
      "frame-src 'none'",
      "frame-ancestors 'none'",
      // No Flash/plugins
      "object-src 'none'",
      // Restrict base tag hijacking
      "base-uri 'self'",
      // Forms must submit to same origin
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: imageRemotePatterns,
  },
  experimental: {
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
