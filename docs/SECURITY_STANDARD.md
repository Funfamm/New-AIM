# AIM Studio Lite — Security Standard

## Authentication & Session

- All sessions use Auth.js v5 with JWT strategy. Session tokens must never be stored in localStorage.
- Admin and Super Admin roles are enforced in middleware (`middleware.ts`) and re-verified inside every Server Action via `requireAdmin()`.
- `requireAuth()` must be called at the top of every user-facing Server Action that touches private data.
- Sessions carry `id` and `role` — never trust role from the client; always read from the JWT or DB.
- Password reset tokens must be short-lived (≤ 30 minutes), single-use, and hashed before storage.
- Google OAuth users must verify email before being permitted to set a password.

## Authorization

- Every admin route: verify `session.user.role === "ADMIN" || "SUPER_ADMIN"` server-side before any data access.
- Every user-owned record (watchlist, comments, casting applications, watch progress): verify `record.userId === session.user.id` before read or write.
- Never expose internal IDs in URLs where they can be guessed. Use slugs or opaque tokens.
- Public APIs must not expose admin endpoints or admin-only data under any circumstance.

## Input Validation

- Validate all Server Action inputs at the boundary — do not trust shape, length, or type.
- Sanitize HTML output. Never render raw user-supplied HTML without escaping.
- Validate file uploads: check mime type, extension, and size server-side. Never trust `Content-Type` from the client.
- Email addresses must be lowercased and trimmed before storage and lookup.

## Secrets & Environment Variables

- Secrets live only in environment variables. Never hardcode tokens, keys, or connection strings.
- Never log or print env var values — redact in all output (error messages, debug logs, console).
- `.env.local` must never be committed. `.env.local.example` contains only placeholder values.
- Rotate secrets immediately if exposed.

## Admin Actions Audit Log

- Every destructive or privileged admin action (delete, status change, role change, suspension) must be logged with: who did it, what changed, when, and the before/after state where practical.
- Logs must be append-only. Admins must not be able to delete their own audit trail.

## HTTP Security

- Security headers must be set on all responses: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Content Security Policy (CSP) must be configured and tightened over time. Start restrictive; open only what is necessary.
- CORS must be explicit. Never `Access-Control-Allow-Origin: *` on authenticated or admin endpoints.
- HTTPS only in production. Redirect HTTP → HTTPS at the edge.

## Media & Storage

- Private media (casting uploads, R2 assets not yet published) must never be accessible via public URLs.
- Signed/expiring URLs must be used for private media access.
- HLS content must follow the public/private path split defined in `docs/` HLS rules.
- Never expose R2 bucket names, endpoint URLs, or access keys to the client.

## Rate Limiting & Abuse Prevention

- Public endpoints (login, register, password reset, notify-me signup, comments) must be rate-limited.
- Suspicious patterns (repeated failed logins, rapid signups from one IP) must be logged.
- Email sending must be rate-limited per recipient and per type to prevent abuse.

## Dependency Security

- Run `npm audit` before every release. Block on high/critical vulnerabilities.
- Keep dependencies up to date. Review changelogs before major version upgrades.
- Do not install packages speculatively. Every dependency must justify its weight.
