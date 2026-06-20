"use server";

import { sendEmail } from "@/lib/email";
import { premiumTransactionalEmail } from "@/lib/email-base";
import { rateLimit } from "@/lib/rate-limit";

const STUDIO_INBOX = "aimstudio@impactaistudio.com";

const SUBJECT_LABELS: Record<string, string> = {
  general:      "General",
  press:        "Press",
  partnerships: "Partnerships",
  casting:      "Casting",
  support:      "Support",
  other:        "Other",
};

export async function submitContactForm(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const name    = (formData.get("name")    as string | null)?.trim() ?? "";
  const email   = (formData.get("email")   as string | null)?.trim().toLowerCase() ?? "";
  const subject = (formData.get("subject") as string | null)?.trim() ?? "";
  const message = (formData.get("message") as string | null)?.trim() ?? "";

  if (!name)    return { ok: false, error: "Name is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "A valid email address is required." };
  if (!message) return { ok: false, error: "Message is required." };

  const rl = rateLimit(`contact:${email}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) return { ok: false, error: "Too many submissions. Please try again later." };

  const label  = SUBJECT_LABELS[subject] ?? "General";
  const bodyHtml = `
    <p style="margin:0 0 16px"><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
    <p style="margin:0 0 16px"><strong>Topic:</strong> ${escapeHtml(label)}</p>
    <hr style="border:none;border-top:1px solid #333;margin:0 0 16px" />
    <p style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</p>
  `;

  const html = premiumTransactionalEmail({
    label:    "Contact Form",
    title:    `New message from ${name}`,
    bodyHtml,
  });

  await sendEmail({
    to:      STUDIO_INBOX,
    subject: `[Contact] ${label} — ${name}`,
    html,
    type:    "CONTACT_FORM",
    metadata: { senderName: name, senderEmail: email, topic: subject },
  });

  return { ok: true };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
