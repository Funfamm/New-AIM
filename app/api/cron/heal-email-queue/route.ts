/**
 * POST /api/cron/heal-email-queue
 *
 * Email failure watchdog — resets FAILED EmailQueue items that still
 * have retries remaining back to QUEUED so the normal queue processor
 * can pick them up on its next cycle.
 *
 * Protected by CRON_SECRET.
 * Recommended schedule: every 30 minutes  "* /30 * * * *"
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch failed items — filter in JS because Prisma can't compare two columns
  const failedItems = await prisma.emailQueue.findMany({
    where: { status: "FAILED" },
    select: { id: true, retryCount: true, maxRetries: true, to: true, subject: true },
  });

  const retryable  = failedItems.filter((e) => e.retryCount < e.maxRetries);
  const permanent  = failedItems.filter((e) => e.retryCount >= e.maxRetries);

  if (retryable.length > 0) {
    await prisma.emailQueue.updateMany({
      where: { id: { in: retryable.map((e) => e.id) } },
      data: {
        status:      "QUEUED",
        scheduledAt: new Date(),
        error:       null,
      },
    });
  }

  // Notify admins about permanently failed emails
  if (permanent.length > 0) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type:  "SYSTEM" as const,
          title: `${permanent.length} email${permanent.length === 1 ? "" : "s"} permanently failed`,
          body:  "Max retry attempts exceeded. Review the email queue for details.",
          href:  "/admin/email",
        })),
      });
    }
  }

  return NextResponse.json({
    ok:            true,
    failedFound:   failedItems.length,
    requeued:      retryable.length,
    permanent:     permanent.length,
  });
}
