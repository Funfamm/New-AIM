"use server";

// Trigger Notify Me follow-up for a CTA's signups.
// - All eligible signups: queue bulk email via ACS/Graph.
// - Signups with userId:  also create in-app Notification.
// - Tracks notifyEmailSentAt, notifyInAppSentAt, lastNotifiedAt per signup.
// - Skips signups already notified (notifyEmailSentAt set) unless resend requested.

import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  enqueueBulkForRecipients,
  buildNotifyMeFollowupEmail,
  checkSelectedBulkProvider,
} from "@/lib/bulk-email";

export type FollowupResult = {
  queued:     number;
  inApp:      number;
  suppressed: number;
  skipped:    number;
  failed:     number;
  error?:     string;
};

export async function sendNotifyMeFollowupEmails(
  ctaId: string,
  resend = false,
): Promise<FollowupResult> {
  await requireAdmin();

  // Selected bulk provider must be configured
  const providerCheck = await checkSelectedBulkProvider();
  if (!providerCheck.ok) {
    return { queued: 0, inApp: 0, suppressed: 0, skipped: 0, failed: 0, error: providerCheck.error };
  }

  // Admin settings: both sending flags must be on
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: { emailSendingEnabled: true, bulkEmailSendingEnabled: true },
  });
  if (!settings?.emailSendingEnabled) {
    return { queued: 0, inApp: 0, suppressed: 0, skipped: 0, failed: 0, error: "Email sending is disabled in Admin Settings." };
  }
  if (!settings?.bulkEmailSendingEnabled) {
    return { queued: 0, inApp: 0, suppressed: 0, skipped: 0, failed: 0, error: "Bulk email sending is disabled in Admin Settings → Email." };
  }

  // Load the CTA and its work
  const cta = await prisma.notifyMeCta.findUnique({
    where:  { id: ctaId },
    select: {
      id: true,
      work: { select: { slug: true, title: true, type: true } },
    },
  });
  if (!cta) return { queued: 0, inApp: 0, suppressed: 0, skipped: 0, failed: 0, error: "CTA not found." };

  // Load all signups for this CTA
  const allSignups = await prisma.notifyMeSignup.findMany({
    where:  { ctaId },
    select: { id: true, email: true, name: true, userId: true, notifyEmailSentAt: true },
  });
  if (allSignups.length === 0) {
    return { queued: 0, inApp: 0, suppressed: 0, skipped: 0, failed: 0 };
  }

  // ── Duplicate delivery guard ──────────────────────────────────────────────
  const alreadyNotified = allSignups.filter(s => s.notifyEmailSentAt !== null);
  const pendingSignups  = resend ? allSignups : allSignups.filter(s => s.notifyEmailSentAt === null);
  const skippedCount    = resend ? 0 : alreadyNotified.length;

  if (pendingSignups.length === 0) {
    return { queued: 0, inApp: 0, suppressed: 0, skipped: skippedCount, failed: 0 };
  }

  // ── Opt-out check for registered users ───────────────────────────────────
  const pendingEmails = pendingSignups.map(s => s.email.toLowerCase().trim());
  const optedOutUsers = await prisma.userPreferences.findMany({
    where: {
      notifyMeFollowupEmails: false,
      user: { email: { in: pendingEmails } },
    },
    select: { user: { select: { email: true } } },
  });
  const optedOutSet = new Set(optedOutUsers.map(p => p.user.email.toLowerCase().trim()));
  const eligibleSignups = pendingSignups.filter(s => !optedOutSet.has(s.email.toLowerCase().trim()));
  const optedOutCount   = pendingSignups.length - eligibleSignups.length;

  const { slug, title: workTitle, type: workType } = cta.work;

  // ── Enqueue bulk emails ───────────────────────────────────────────────────
  const campaignId = `notifyme_followup_${ctaId}`;
  let failedCount  = 0;

  const emailResult = await enqueueBulkForRecipients({
    recipients: eligibleSignups,
    type:       "NOTIFY_ME_FOLLOWUP",
    campaignId,
    buildEmail: (r) => buildNotifyMeFollowupEmail({
      recipientEmail: r.email,
      recipientName:  r.name ?? null,
      workTitle,
      workSlug:       slug,
      workType,
    }),
  });

  // ── In-app notifications for logged-in signups ────────────────────────────
  const now           = new Date();
  const loggedInSignups = eligibleSignups.filter(s => !!s.userId);
  let inAppCount = 0;

  for (const signup of loggedInSignups) {
    try {
      await prisma.notification.create({
        data: {
          userId:  signup.userId!,
          type:    "NOTIFY_ME",
          title:   `${workTitle} is ready`,
          body:    "The update you asked for is now available on AIM Studio.",
          href:    `/works/${slug}`,
          workId:  null,
        },
      });
      inAppCount++;
    } catch {
      failedCount++;
    }
  }

  // ── Update delivery tracking on signups ──────────────────────────────────
  // Mark emailed signups
  const emailedIds = eligibleSignups.map(s => s.id);
  if (emailedIds.length > 0) {
    await prisma.notifyMeSignup.updateMany({
      where: { id: { in: emailedIds } },
      data:  { notifyEmailSentAt: now, lastNotifiedAt: now },
    });
  }

  // Mark in-app notified signups
  const inAppIds = loggedInSignups.map(s => s.id);
  if (inAppIds.length > 0) {
    await prisma.notifyMeSignup.updateMany({
      where: { id: { in: inAppIds } },
      data:  { notifyInAppSentAt: now },
    });
  }

  revalidatePath(`/admin/notify-me-ctas/${ctaId}`);
  revalidatePath("/admin/email");
  revalidatePath("/admin/email/logs");

  return {
    queued:     emailResult.queued,
    inApp:      inAppCount,
    suppressed: emailResult.suppressed,
    skipped:    skippedCount + optedOutCount,
    failed:     failedCount,
  };
}
