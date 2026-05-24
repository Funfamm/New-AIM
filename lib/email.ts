// Email sending module — isolated so the provider can be swapped without touching callsites
// Priority: Microsoft Graph (Azure) → SMTP (future) → DEV console log fallback
// No tracking pixels. Transactional only.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ── Microsoft Graph sender ────────────────────────────────────

async function sendViaGraph(to: string, subject: string, html: string): Promise<void> {
  const clientId     = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId     = process.env.AZURE_TENANT_ID;
  const from         = process.env.GRAPH_EMAIL_SENDER;

  if (!clientId || !clientSecret || !tenantId || !from) {
    throw new Error("GRAPH_EMAIL_SENDER env vars incomplete");
  }

  // Acquire OAuth2 token from Azure AD
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!tokenRes.ok) {
    throw new Error(`Graph token request failed: ${tokenRes.status}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Send mail via Graph API
  const mailRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: false,
      }),
    }
  );

  if (!mailRes.ok) {
    const body = await mailRes.text();
    throw new Error(`Graph sendMail failed: ${mailRes.status} — ${body}`);
  }
}

// ── SMTP sender (stub — add nodemailer when approved) ─────────

// async function sendViaSMTP(...) { ... }

// ── Dispatch ──────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const isDev = process.env.NODE_ENV !== "production";

  // Production: try Microsoft Graph
  if (!isDev) {
    await sendViaGraph(to, subject, html);
    return;
  }

  // Dev: try Graph if configured, otherwise log only
  const graphConfigured =
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID &&
    process.env.GRAPH_EMAIL_SENDER;

  if (graphConfigured) {
    await sendViaGraph(to, subject, html);
    return;
  }

  // DEV ONLY — log reset link to console, never in production
  console.log("\n[DEV ONLY — EMAIL NOT SENT]");
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  // Strip HTML tags for readable console output
  console.log(`Body:    ${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
  console.log("[END DEV EMAIL]\n");
}

// ── Password reset email ───────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string,
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const subject = "Reset your AIM Studio password";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111111;border:1px solid #2a2a2a;border-radius:12px;padding:40px 32px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f9fafb;letter-spacing:-0.3px;">AIM<span style="color:#e8c97e;">Studio</span></p>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#f9fafb;">Reset your password</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
            We received a request to reset the password for your AIM Studio account.
            Click the button below to choose a new password. This link expires in 30 minutes.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#e8c97e;color:#0a0a0a;font-size:14px;font-weight:600;
                    text-decoration:none;padding:12px 28px;border-radius:6px;">
            Reset Password
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
            If you did not request a password reset, you can safely ignore this email.
            Your password will not change.
          </p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #2a2a2a;">
          <p style="margin:0;font-size:11px;color:#6b7280;">
            If the button does not work, copy this link:<br>
            <span style="color:#e5e7eb;word-break:break-all;">${resetUrl}</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail(to, subject, html);
}
