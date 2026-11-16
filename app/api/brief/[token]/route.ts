/**
 * Public client-brief endpoint. The unguessable token in the URL is the only
 * credential, so a client needs no account.
 *   GET → current answers + status
 *   PUT → autosave answers; { submit: true } marks the brief submitted and emails the studio
 *
 * Guards: per-IP rate limit, body size cap, token shape check, honeypot, and every
 * answer is re-validated against the shared question schema before it is stored.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { sendEmail } from "@/lib/email";
import { premiumTransactionalEmail } from "@/lib/email-base";
import { DEMO_TOKEN, sanitizeAnswers, summarize, type Answers } from "@/lib/client-brief/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Autosave fires about once per pause in typing; 40/min per IP leaves real use untouched.
const LIMIT = 40;
const WINDOW_MS = 60_000;
const MAX_BODY = 100_000;
const TOKEN_RE = /^[a-z0-9-]{4,64}$/;

const NOTIFY_TO = process.env.ADMIN_ALERT_EMAIL || process.env.GRAPH_EMAIL_SENDER || "";

async function limited(): Promise<NextResponse | null> {
  const rl = rateLimit(`client-brief:${await getClientIpHash()}`, LIMIT, WINDOW_MS);
  return rl.allowed ? null : NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const blocked = await limited();
  if (blocked) return blocked;
  const { token } = await params;
  if (token === DEMO_TOKEN) return NextResponse.json({ demo: true, status: "in_progress", answers: {} });
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const brief = await prisma.clientBrief.findUnique({
    where: { token },
    select: { club: true, status: true, answers: true },
  });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ club: brief.club, status: brief.status.toLowerCase(), answers: sanitizeAnswers(brief.answers) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const blocked = await limited();
  if (blocked) return blocked;
  const { token } = await params;

  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: { answers?: unknown; submit?: unknown; hp?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const answers = sanitizeAnswers(body.answers);
  const submit = body.submit === true;

  // Demo link: run the whole experience, store nothing.
  if (token === DEMO_TOKEN) {
    return NextResponse.json({ ok: true, demo: true, status: submit ? "submitted" : "in_progress" });
  }
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Honeypot — fake success, store nothing.
  if (body.hp) return NextResponse.json({ ok: true, status: "in_progress" });

  const brief = await prisma.clientBrief.findUnique({
    where: { token },
    select: { id: true, club: true, status: true },
  });
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const str = (k: string) => (typeof answers[k] === "string" ? (answers[k] as string) : null);
  if (submit && (!str("club") || !str("contact_name") || (!str("email") && !str("phone")))) {
    return NextResponse.json(
      { error: "Please add your club name, your name, and an email or phone number." },
      { status: 400 },
    );
  }

  const wasSubmitted = brief.status === "SUBMITTED";
  const status = submit || wasSubmitted ? "SUBMITTED" : "IN_PROGRESS";
  const now = new Date();
  await prisma.clientBrief.update({
    where: { id: brief.id },
    data: {
      answers,
      status,
      club:        str("club") || brief.club,
      contactName: str("contact_name"),
      email:       str("email"),
      phone:       str("phone"),
      lastSeenAt:  now,
      ...(submit ? { submittedAt: now } : {}),
    },
  });

  // Awaited (not fire-and-forget): a serverless function can be frozen the moment the
  // response is sent, which would drop the email. Never fails the client's submit.
  if (submit) await notifyStudio(brief.id, answers, wasSubmitted).catch(() => {});

  return NextResponse.json({ ok: true, status: status.toLowerCase() });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function notifyStudio(id: string, a: Answers, isUpdate: boolean): Promise<void> {
  if (!NOTIFY_TO) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://impactaistudio.com";
  const club = String(a.club || "A client");
  const sections = summarize(a)
    .filter((s) => s.rows.length)
    .map(
      (s) => `
      <p style="margin:22px 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#e8c97e;">${esc(s.title)}</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">${s.rows
        .map(
          ([q, v]) => `
        <tr>
          <td style="padding:5px 12px 5px 0;font-size:13px;color:#9ca3af;vertical-align:top;width:40%;">${esc(q)}</td>
          <td style="padding:5px 0;font-size:13px;color:#e5e7eb;white-space:pre-wrap;">${esc(v)}</td>
        </tr>`,
        )
        .join("")}</table>`,
    )
    .join("");
  const bodyHtml = `
    <p style="margin:0 0 6px;font-size:14px;color:#d1d5db;line-height:1.6;">
      <strong style="color:#f9fafb;">${esc(club)}</strong> ${isUpdate ? "updated" : "submitted"} their website brief.
    </p>
    <p style="margin:0 0 4px;font-size:13px;line-height:1.6;">
      <a href="${appUrl}/admin/client-briefs?id=${encodeURIComponent(id)}" style="color:#e8c97e;">Open it in the admin panel to see the quote</a>
    </p>
    ${sections}`;
  await sendEmail({
    to:      NOTIFY_TO,
    subject: `${isUpdate ? "Updated" : "New"} website brief: ${club}`,
    html:    premiumTransactionalEmail({ title: isUpdate ? "Client brief updated" : "New client brief", bodyHtml }),
    type:    "ADMIN_ALERT",
  });
}
