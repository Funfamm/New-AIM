// Shared premium HTML email wrapper — transactional (no unsubscribe footer).
// Used by lib/email.ts (auth emails) and lib/casting/casting-emails.ts (casting notifications).
// Bulk emails use bulkBaseTemplate() in lib/bulk-email.ts (adds unsubscribe footer).
// Server-safe: no Prisma, no browser APIs, pure string helpers only.

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Wraps bodyHtml in the AIM Studio premium email shell.
 *
 * Design: 600px dark card (#111111), gold accent border under the header,
 * cinematic footer. Email-safe: no external fonts, no gradients, no JS.
 */
export function premiumTransactionalEmail(opts: {
  title:    string;
  bodyHtml: string;
  label?:   string;   // e.g. "Security Alert", "Casting Update" — displayed above title in caps
  imageUrl?: string;  // full-bleed poster between header and content (optional)
}): string {
  const labelRow = opts.label
    ? `<p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">${esc(opts.label)}</p>`
    : "";

  const imageRow = opts.imageUrl
    ? `<tr><td style="padding:0;font-size:0;line-height:0;"><img src="${esc(opts.imageUrl)}" alt="${esc(opts.title)}" width="598" style="width:100%;max-width:598px;height:auto;display:block;border:0;" /></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:600px;background:#111111;border:1px solid #2a2a2a;border-radius:8px;">

        <!-- ── Header ─────────────────────────────────────── -->
        <tr><td style="padding:22px 32px;border-bottom:2px solid #e8c97e;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#f9fafb;letter-spacing:-0.4px;">
            AIM<span style="color:#e8c97e;">Studio</span>
          </p>
        </td></tr>

        ${imageRow}

        <!-- ── Content ────────────────────────────────────── -->
        <tr><td style="padding:32px 32px 28px;">
          ${labelRow}
          <h1 style="margin:0 0 18px;font-size:22px;font-weight:600;color:#f9fafb;line-height:1.3;">${esc(opts.title)}</h1>
          ${opts.bodyHtml}
        </td></tr>

        <!-- ── Footer ─────────────────────────────────────── -->
        <tr><td style="padding:18px 32px;background:#0a0a0a;border-top:1px solid #1a1a1a;border-radius:0 0 8px 8px;">
          <p style="margin:0;font-size:11px;color:#4b5563;line-height:1.6;letter-spacing:0.03em;">
            AIM Studio &nbsp;&middot;&nbsp; Don&rsquo;t look away.
          </p>
          <p style="margin:4px 0 0;font-size:11px;color:#374151;line-height:1.6;">
            You are receiving this email because you have an account on AIM Studio.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
