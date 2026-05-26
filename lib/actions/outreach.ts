"use server";

// Outreach Center — server actions.
// sendAnnouncement: create + publish an announcement atomically.
// sendReleaseOutreach / sendEpisodeOutreach: Phase 7 (reuse release-email helpers).
// All admin-gated. No secrets exposed. No client bundle.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBulkInAppNotification } from "@/lib/notifications";
import {
  enqueueBulkForRecipients,
  buildAnnouncementEmail,
  isAcsConfigured,
} from "@/lib/bulk-email";
import type { NotificationType } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  return session.user;
}

// ── Audience resolvers ────────────────────────────────────────
// Returns { email, name } rows for the given audience type.
// All resolvers respect ACTIVE status and non-empty email.
// Email audience also requires announcement opt-in.

export type AudienceType = "all" | "admins" | "notify_me" | "saved_work";

async function resolveEmailAudience(
  audienceType: string,
): Promise<{ email: string; name: string | null }[]> {
  const base = {
    status: "ACTIVE" as const,
    email:  { not: "" },
  };

  if (audienceType === "admins") {
    return prisma.user.findMany({
      where: { ...base, role: "ADMIN" },
      select: { email: true, name: true },
    });
  }

  if (audienceType === "notify_me") {
    // Distinct emails from NotifyMeSignup — these may not be registered users
    const signups = await prisma.notifyMeSignup.findMany({
      select: { email: true, name: true },
      distinct: ["email"],
    });
    return signups.map((s) => ({ email: s.email, name: s.name ?? null }));
  }

  if (audienceType === "saved_work") {
    // Users who have saved at least one work
    return prisma.user.findMany({
      where: {
        ...base,
        savedWorks: { some: {} },
        OR: [
          { preferences: null },
          { preferences: { emailNotifications: true, announcementNotifications: true } },
        ],
      },
      select: { email: true, name: true },
    });
  }

  // Default: "all" — all opted-in active users
  return prisma.user.findMany({
    where: {
      ...base,
      OR: [
        { preferences: null },
        { preferences: { emailNotifications: true, announcementNotifications: true } },
      ],
    },
    select: { email: true, name: true },
  });
}

export type OutreachResult = {
  created?:    number;   // in-app notifications dispatched
  queued?:     number;   // EmailQueue rows created
  suppressed?: number;   // skipped — on suppression list
  skipped?:    number;   // skipped — other reason
  error?:      string;
};

// ── Announcement (create + publish atomically) ────────────────
// Audience: all active users (targeting expanded in Phase 6).
// In-app: always sent.
// Email: only if sendEmail=true AND ACS is configured AND user opted in.

export async function sendAnnouncement(
  formData: FormData,
): Promise<OutreachResult> {
  await requireAdmin();

  const title       = (formData.get("title")       as string | null)?.trim() ?? "";
  const body        = (formData.get("body")        as string | null)?.trim() ?? "";
  const href        = (formData.get("href")        as string | null)?.trim() || null;
  const hrefLabel   = (formData.get("hrefLabel")   as string | null)?.trim() || null;
  const sendEmail   = formData.get("sendEmail") === "on";
  const expiresRaw  = formData.get("expiresAt")  as string | null;
  const audienceType = (formData.get("audienceType") as string | null) ?? "all";

  if (!title) return { error: "Title is required." };
  if (!body)  return { error: "Body is required." };

  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && isNaN(expiresAt.getTime())) return { error: "Invalid expiry date." };

  // Create and publish in one step
  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      href,
      hrefLabel,
      sendInApp: true,
      sendEmail,
      expiresAt,
      audienceType,
      publishedAt: new Date(),
    },
  });

  // ── In-app broadcast ──────────────────────────────────────────
  // Audience for in-app: always ALL active users (notifications are cheap).
  // Email audience is scoped further below by audienceType.
  const inAppResult = await createBulkInAppNotification({
    type:      "ANNOUNCEMENT" as NotificationType,
    title,
    body,
    href:      href ?? undefined,
    expiresAt: expiresAt ?? undefined,
  });

  const created = inAppResult.created;
  let queued     = 0;
  let suppressed = 0;
  let skipped    = 0;

  // ── Email (ACS) ───────────────────────────────────────────────
  if (sendEmail) {
    if (!isAcsConfigured()) {
      await prisma.announcement.update({
        where: { id: announcement.id },
        data:  { recipientCount: created, emailQueuedCount: 0 },
      });
      revalidatePath("/admin/outreach");
      return {
        created,
        queued: 0,
        error: `In-app sent to ${created} user${created === 1 ? "" : "s"}. ACS is not configured — email not queued.`,
      };
    }

    // Check global email settings
    const settings = await prisma.adminSettings.findUnique({
      where:  { id: "singleton" },
      select: { emailSendingEnabled: true, bulkEmailSendingEnabled: true },
    });
    if (!settings?.emailSendingEnabled || !settings?.bulkEmailSendingEnabled) {
      await prisma.announcement.update({
        where: { id: announcement.id },
        data:  { recipientCount: created, emailQueuedCount: 0 },
      });
      revalidatePath("/admin/outreach");
      return {
        created,
        queued: 0,
        error: `In-app sent to ${created} user${created === 1 ? "" : "s"}. Bulk email is disabled in Admin Settings.`,
      };
    }

    // Fetch recipients scoped to audienceType
    const users = await resolveEmailAudience(audienceType);

    const campaignId = `announcement_${announcement.id}`;
    const emailResult = await enqueueBulkForRecipients({
      recipients: users,
      type:       "ANNOUNCEMENT",
      campaignId,
      buildEmail: (r) => buildAnnouncementEmail({
        recipientEmail: r.email,
        title,
        body,
        href,
        hrefLabel,
      }),
    });

    queued     = emailResult.queued;
    suppressed = emailResult.suppressed;
    skipped    = emailResult.skipped;

    await prisma.announcement.update({
      where: { id: announcement.id },
      data:  { emailSentAt: new Date() },
    });
  }

  // Persist delivery counts on the announcement record
  await prisma.announcement.update({
    where: { id: announcement.id },
    data:  { recipientCount: created, emailQueuedCount: queued },
  });

  revalidatePath("/admin/outreach");
  return { created, queued, suppressed, skipped };
}
