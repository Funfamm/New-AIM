# Security Rules (summary — full detail in docs/SECURITY_STANDARD.md)

- Never print, log, or output env var values. Check names only.
- Every admin route: `requireAdmin()` inside the Server Action, not just middleware.
- Rate limit public mutation endpoints. See `lib/rate-limit.ts`.
- Passwords: bcryptjs 12 rounds. Never store plain text.
- Tokens: `crypto.randomUUID()`. Never predictable IDs.
- File uploads: validate mime type and size server-side.
- Email addresses: lowercase + trim before storage and lookup.
- Audit log: all admin destructive actions via `writeAudit()` in `lib/audit.ts`.
