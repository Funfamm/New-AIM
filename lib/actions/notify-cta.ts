"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import type { CtaType } from "@prisma/client";



// ── Admin: upsert CTA for a work ─────────────────────────────────────────────
export async function upsertCta(
  workId: string,
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const type                  = formData.get("type") as CtaType;
  const headline              = ((formData.get("headline") as string) ?? "").trim();
  const body                  = ((formData.get("body") as string) ?? "").trim() || null;
  const ctaLabel              = ((formData.get("ctaLabel") as string) ?? "").trim();
  const triggerSecondsFromEnd = parseInt(formData.get("triggerSecondsFromEnd") as string, 10);
  const isEnabled             = formData.get("isEnabled") === "1";

  if (!["RELEASE", "MORE", "POST_RELEASE"].includes(type))
    return { ok: false, error: "Invalid CTA type." };
  if (!headline) return { ok: false, error: "Headline is required." };
  if (!ctaLabel) return { ok: false, error: "Button label is required." };
  if (isNaN(triggerSecondsFromEnd) || triggerSecondsFromEnd < 0)
    return { ok: false, error: "Trigger seconds must be 0 or more." };

  await prisma.notifyMeCta.upsert({
    where:  { workId },
    update: { type, headline, body, ctaLabel, triggerSecondsFromEnd, isEnabled },
    create: { workId, type, headline, body, ctaLabel, triggerSecondsFromEnd, isEnabled },
  });

  revalidatePath(`/admin/works/${workId}`);
  revalidatePath("/admin/notify-me-ctas");
  return { ok: true };
}

// ── Admin: delete CTA (signups ctaId → null via SetNull, data preserved) ─────
export async function deleteCta(
  ctaId: string,
  workId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    await prisma.notifyMeCta.delete({ where: { id: ctaId } });
    revalidatePath(`/admin/works/${workId}`);
    revalidatePath("/admin/notify-me-ctas");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not remove CTA." };
  }
}

// ── Admin: toggle enabled/disabled ───────────────────────────────────────────
export async function toggleCtaEnabled(
  ctaId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    const cta = await prisma.notifyMeCta.findUnique({ where: { id: ctaId }, select: { isEnabled: true, workId: true } });
    if (!cta) return { ok: false, error: "CTA not found." };
    await prisma.notifyMeCta.update({ where: { id: ctaId }, data: { isEnabled: !cta.isEnabled } });
    revalidatePath("/admin/notify-me-ctas");
    revalidatePath(`/admin/works/${cta.workId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not toggle CTA." };
  }
}

// ── Public: sign up for a CTA ────────────────────────────────────────────────
// Deduplication: server checks DB; client stores in localStorage after success.
// For logged-in users: email and userId come from the server session only —
// client-supplied email is ignored to prevent spoofing.
export async function notifyMeSignup(
  ctaId: string,
  workId: string,
  workTitle: string | null,
  email: string,
  name?: string
): Promise<{ ok: boolean; error?: string }> {
  // Resolve the authenticated session server-side
  const session = await auth();
  const sessionUser = session?.user as { id?: string; email?: string; name?: string } | undefined;

  // Determine the canonical email: session email for logged-in users,
  // client-submitted email for guests. Never trust client for logged-in.
  const resolvedEmail = sessionUser?.email
    ? sessionUser.email.trim().toLowerCase()
    : email.trim().toLowerCase();

  const userId   = sessionUser?.id   ?? null;
  const userName = sessionUser?.name ?? name?.trim() ?? null;

  if (!resolvedEmail || !resolvedEmail.includes("@"))
    return { ok: false, error: "Please enter a valid email address." };

  // Rate limit per email (10/hr) AND per IP (20/hr). Guests submit a client-controlled
  // email, so the email key alone is bypassable by rotating it — the IP key backstops it.
  const rlEmail = rateLimit(`ncta:${resolvedEmail}`, 10, 60 * 60 * 1000);
  const rlIp    = rateLimit(`ncta-ip:${await getClientIpHash()}`, 20, 60 * 60 * 1000);
  if (!rlEmail.allowed || !rlIp.allowed) return { ok: false, error: "Too many requests. Please try again later." };

  // Check suppression list — silently succeed so we don't leak suppression status
  const suppressed = await prisma.emailSuppression.findUnique({
    where: { email: resolvedEmail },
    select: { active: true },
  });
  if (suppressed?.active) return { ok: true };

  // Deduplicate: already signed up for this CTA
  const existing = await prisma.notifyMeSignup.findFirst({
    where: { ctaId, email: resolvedEmail },
    select: { id: true, userId: true },
  });
  if (existing) {
    // Back-fill userId if this was a previous guest signup and user is now logged in
    if (!existing.userId && userId) {
      await prisma.notifyMeSignup.update({
        where: { id: existing.id },
        data:  { userId },
      });
    }
    return { ok: true };
  }

  await prisma.notifyMeSignup.create({
    data: {
      ctaId,
      workId,
      workTitle,
      email:  resolvedEmail,
      name:   sessionUser ? (sessionUser.name ?? null) : (name?.trim() || null),
      userId,
    },
  });

  return { ok: true };
}
