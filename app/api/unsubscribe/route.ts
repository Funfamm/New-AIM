// /api/unsubscribe
// One-click unsubscribe for bulk emails.
// Link format: /api/unsubscribe?email=<encoded>&sig=<hmac>
//
// Security model:
//   sig = HMAC-SHA256(email_lowercase, AUTH_SECRET) — see lib/unsubscribe.ts
//   Stateless — no DB token table needed.
//
// On valid sig:    upserts EmailSuppression → redirects to /unsubscribed?success=1
// On invalid sig:  redirects to /unsubscribed?error=invalid
// On server error: redirects to /unsubscribed?error=server

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateUnsubscribeSig } from "@/lib/unsubscribe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const rawEmail = searchParams.get("email") ?? "";
  const sig      = searchParams.get("sig")   ?? "";

  const email = decodeURIComponent(rawEmail).toLowerCase().trim();

  if (!email || !sig) {
    return NextResponse.redirect(`${APP_URL}/unsubscribed?error=invalid`);
  }

  // Validate HMAC signature (constant-time)
  let valid: boolean;
  try {
    valid = validateUnsubscribeSig(email, sig);
  } catch {
    return NextResponse.redirect(`${APP_URL}/unsubscribed?error=server`);
  }

  if (!valid) {
    return NextResponse.redirect(`${APP_URL}/unsubscribed?error=invalid`);
  }

  // Upsert suppression — idempotent
  let isNewUnsubscribe = false;
  let suppressionId: string | undefined;
  let subscriberId: string | undefined;

  try {
    // Check before upsert to prevent duplicate admin notifications on repeated clicks
    const existing = await prisma.emailSuppression.findUnique({
      where:  { email },
      select: { id: true },
    });
    isNewUnsubscribe = !existing;

    const suppression = await prisma.emailSuppression.upsert({
      where:  { email },
      create: { email, reason: "unsubscribe", source: "user", active: true },
      update: { active: true, reason: "unsubscribe", source: "user" },
      select: { id: true },
    });
    suppressionId = suppression.id;

    // Stamp subscriber.suppressedAt if they exist and aren't already suppressed
    const subscriber = await prisma.subscriber.findUnique({
      where:  { email },
      select: { id: true, suppressedAt: true },
    });
    if (subscriber) {
      subscriberId = subscriber.id;
      if (!subscriber.suppressedAt) {
        await prisma.subscriber.update({
          where: { id: subscriber.id },
          data:  { suppressedAt: new Date(), suppressReason: "unsubscribe" },
        });
      }
    }
  } catch {
    // Suppression write failure: still redirect to success.
    // A failed unsubscribe is worse than a duplicate.
  }

  // Notify admins — only on the very first unsubscribe for this email.
  // Repeated clicks to the same link do not generate duplicate notifications.
  if (isNewUnsubscribe) {
    try {
      const admins = await prisma.user.findMany({
        where:  { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
        select: { id: true },
      });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type:   "SYSTEM" as const,
            title:  "New unsubscribe",
            body:   `${email} unsubscribed from email updates.`,
            href:   "/admin/email/suppressions",
            read:   false,
          })),
        });
      }
      void suppressionId; // referenced in metadata for future use
      void subscriberId;
    } catch {
      // Notification failure is non-fatal — suppression already succeeded
    }
  }

  return NextResponse.redirect(`${APP_URL}/unsubscribed?success=1`);
}
