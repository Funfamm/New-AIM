import type { NextConfig } from "next";

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
      // Next.js requires unsafe-inline for hydration scripts; unsafe-eval for dev HMR
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind uses inline styles; Google Fonts stylesheet
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Google Fonts webfont files
      "font-src 'self' https://fonts.gstatic.com",
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
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
