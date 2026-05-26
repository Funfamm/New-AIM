"use server";

// Outreach Center — server actions.
// sendAnnouncement:      create + publish atomically. Supports channel selection + imageUrl.
// sendReleaseOutreach:   wraps release email logic with imageUrl support.
// sendEpisodeOutreach:   wraps episode email logic with imageUrl support.
// All admin-gated. No secrets exposed. No client bundle.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBulkInAppNotification } from "@/lib/notifications";
import {
  enqueueBulkForRecipients,
  buildAnnouncementEmail,
  buildNewReleaseEmail,
  buildNewEpisodeEmail,
  isAcsConfigured,
} from "@/lib/bulk-email";
import type { NotificationType } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  return session.user;
}

// ── URL safety helper ─────────────────────────────────────────
// Only allow http/https — never javascript:, data:, etc.

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// ── Audience resolvers ────────────────────────────────────────

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
      where:  { ...base, role: "ADMIN" },
      select: { email: true, name: true },
    });
  }

  if (audienceType === "notify_me") {
    const signups = await prisma.notifyMeSignup.findMany({
      select:   { email: true, name: true },
      distinct: ["email"],
    });
    return signups.map((s) => ({ email: s.email, name: s.name ?? null }));
  }

  if (audienceType === "saved_work") {
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

  // "all" — opted-in active users
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

// ── Result type ───────────────────────────────────────────────

export type OutreachResult = {
  created?:    number;   // in-app notifications dispatched
  queued?:     number;   // EmailQueue rows created
  suppressed?: number;
  skipped?:    number;
  error?:      string;
};

// ── Admin email settings guard ───────────────────────────────

async function checkBulkEmailSettings(): Promise<{ ok: boolean; error?: string }> {
  const settings = await prisma.adminSettings.findUnique({
    where:  { id: "singleton" },
    select: {
      emailSendingEnabled:      true,
      bulkEmailSendingEnabled:  true,
      notificationEmailEnabled: true,
    },
  });
  if (!settings?.emailSendingEnabled) {
    return { ok: false, error: "Email sending is disabled in Admin Settings." };
  }
  if (!settings?.bulkEmailSendingEnabled) {
    return { ok: false, error: "Bulk email sending is disabled in Admin Settings → Bulk Email (ACS)." };
  }
  if (!settings?.notificationEmailEnabled) {
    return { ok: false, error: "Notification emails are disabled in Admin Settings → Email." };
  }
  return { ok: true };
}

// ── Announcement (create + publish atomically) ────────────────
// channel: "both" | "inapp" | "email"
// In-app: created when channel is "both" or "inapp".
// Email:  queued when channel is "both" or "email" AND ACS is configured.

export async function sendAnnouncement(
  formData: FormData,
): Promise<OutreachResult> {
  await requireAdmin();

  const title        = (formData.get("title")       as string | null)?.trim() ?? "";
  const body         = (formData.get("body")         as string | null)?.trim() ?? "";
  const href         = (formData.get("href")         as string | null)?.trim() || null;
  const hrefLabel    = (formData.get("hrefLabel")    as string | null)?.trim() || null;
  const imageUrlRaw  = (formData.get("imageUrl")     as string | null)?.trim() || null;
  const channel      = (formData.get("channel")      as string | null) ?? "both";
  const expiresRaw   = formData.get("expiresAt")    as string | null;
  const audienceType = (formData.get("audienceType") as string | null) ?? "all";

  if (!title) return { error: "Title is required." };
  if (!body)  return { error: "Body is required." };

  // CTA paired validation
  if (href && !hrefLabel) return { error: "CTA label is required when a CTA URL is provided." };
  if (hrefLabel && !href) return { error: "CTA URL is required when a CTA label is provided." };
  if (href && !isSafeUrl(href)) return { error: "CTA URL must start with http:// or https://." };

  // Image URL validation
  const imageUrl = imageUrlRaw && isSafeUrl(imageUrlRaw) ? imageUrlRaw : null;
  if (imageUrlRaw && !imageUrl) return { error: "Image URL must start with http:// or https://." };

  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && isNaN(expiresAt.getTime())) return { error: "Invalid expiry date." };

  const wantsInApp  = channel === "both" || channel === "inapp";
  const wantsEmail  = channel === "both" || channel === "email";

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      href,
      hrefLabel,
      sendInApp: wantsInApp,
      sendEmail: wantsEmail,
      expiresAt,
      audienceType,
      publishedAt: new Date(),
    },
  });

  let created    = 0;
  let queued     = 0;
  let suppressed = 0;
  let skipped    = 0;

  // ── In-app broadcast ──────────────────────────────────────────
  if (wantsInApp) {
    const inAppResult = await createBulkInAppNotification({
      type:      "ANNOUNCEMENT" as NotificationType,
      title,
      body,
      href:      href ?? undefined,
      expiresAt: expiresAt ?? undefined,
    });
    created = inAppResult.created;
  }

  // ── Email (ACS) ───────────────────────────────────────────────
  if (wantsEmail) {
    if (!isAcsConfigured()) {
      await prisma.announcement.update({
        where: { id: announcement.id },
        data:  { recipientCount: created, emailQueuedCount: 0 },
      });
      revalidatePath("/admin/outreach");
      return {
        created,
        queued: 0,
        error: wantsInApp
          ? `In-app sent to ${created} user${created === 1 ? "" : "s"}. Bulk email provider (ACS) is not configured.`
          : "Bulk email provider (ACS) is not configured.",
      };
    }

    const settingsCheck = await checkBulkEmailSettings();
    if (!settingsCheck.ok) {
      await prisma.announcement.update({
        where: { id: announcement.id },
        data:  { recipientCount: created, emailQueuedCount: 0 },
      });
      revalidatePath("/admin/outreach");
      return {
        created,
        queued: 0,
        error: wantsInApp
          ? `In-app sent to ${created} user${created === 1 ? "" : "s"}. ${settingsCheck.error}`
          : settingsCheck.error,
      };
    }

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
        imageUrl,
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

  await prisma.announcement.update({
    where: { id: announcement.id },
    data:  { recipientCount: created, emailQueuedCount: queued },
  });

  revalidatePath("/admin/outreach");
  return { created, queued, suppressed, skipped };
}

// ── Release Outreach ──────────────────────────────────────────
// Wraps release email logic with imageUrl support.
// Uses same re-send guard as sendNewReleaseEmail.

export async function sendReleaseOutreach(
  workId:   string,
  imageUrl?: string | null,
): Promise<OutreachResult> {
  await requireAdmin();

  if (!isAcsConfigured()) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Bulk email provider (ACS) is not configured." };
  }
  const settingsCheck = await checkBulkEmailSettings();
  if (!settingsCheck.ok) {
    return { queued: 0, suppressed: 0, skipped: 0, error: settingsCheck.error };
  }

  const work = await prisma.work.findUnique({
    where:  { id: workId },
    select: { id: true, slug: true, title: true, type: true, status: true, description: true, genres: true },
  });
  if (!work)                       return { queued: 0, suppressed: 0, skipped: 0, error: "Work not found." };
  if (work.status !== "PUBLISHED") return { queued: 0, suppressed: 0, skipped: 0, error: "Only published works can trigger release emails." };

  const campaignId = `new_release_${workId}`;
  const existing = await prisma.emailQueue.count({
    where: { campaignId, status: { in: ["QUEUED", "SENT"] } },
  });
  if (existing > 0) {
    return {
      queued: 0, suppressed: 0, skipped: 0,
      error: `A release email for this work has already been queued or sent (${existing} row${existing === 1 ? "" : "s"} found).`,
    };
  }

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      email:  { not: "" },
      OR: [
        { preferences: null },
        { preferences: { emailNewReleases: true, newReleaseNotifications: true } },
      ],
    },
    select: { email: true, name: true },
  });
  if (users.length === 0) return { queued: 0, suppressed: 0, skipped: 0, error: "No eligible recipients." };

  const safeImageUrl = imageUrl && isSafeUrl(imageUrl) ? imageUrl : null;

  const result = await enqueueBulkForRecipients({
    recipients: users,
    type:       "NEW_RELEASE",
    campaignId,
    buildEmail: (r) => buildNewReleaseEmail({
      recipientEmail: r.email,
      workTitle:      work.title,
      workSlug:       work.slug,
      workType:       work.type,
      genres:         work.genres,
      description:    work.description,
      imageUrl:       safeImageUrl,
    }),
  });

  revalidatePath("/admin/outreach");
  return { queued: result.queued, suppressed: result.suppressed, skipped: result.skipped };
}

// ── Episode Outreach ──────────────────────────────────────────

export async function sendEpisodeOutreach(
  workId:   string,
  imageUrl?: string | null,
): Promise<OutreachResult> {
  await requireAdmin();

  if (!isAcsConfigured()) {
    return { queued: 0, suppressed: 0, skipped: 0, error: "Bulk email provider (ACS) is not configured." };
  }
  const settingsCheck = await checkBulkEmailSettings();
  if (!settingsCheck.ok) {
    return { queued: 0, suppressed: 0, skipped: 0, error: settingsCheck.error };
  }

  const episode = await prisma.work.findUnique({
    where:  { id: workId },
    select: {
      id: true, slug: true, title: true, type: true, status: true,
      episodeNumber: true, seasonNumber: true,
      parent: { select: { id: true, slug: true, title: true } },
    },
  });

  if (!episode)                       return { queued: 0, suppressed: 0, skipped: 0, error: "Work not found." };
  if (episode.type !== "EPISODE")     return { queued: 0, suppressed: 0, skipped: 0, error: "This work is not an episode." };
  if (episode.status !== "PUBLISHED") return { queued: 0, suppressed: 0, skipped: 0, error: "Only published episodes can trigger episode emails." };
  if (!episode.parent)                return { queued: 0, suppressed: 0, skipped: 0, error: "Episode has no parent series." };

  const campaignId = `new_episode_${workId}`;
  const existing = await prisma.emailQueue.count({
    where: { campaignId, status: { in: ["QUEUED", "SENT"] } },
  });
  if (existing > 0) {
    return {
      queued: 0, suppressed: 0, skipped: 0,
      error: `An episode email for this episode has already been queued or sent (${existing} row${existing === 1 ? "" : "s"} found).`,
    };
  }

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      email:  { not: "" },
      OR: [
        { preferences: null },
        { preferences: { newEpisodeNotifications: true } },
      ],
    },
    select: { email: true, name: true },
  });
  if (users.length === 0) return { queued: 0, suppressed: 0, skipped: 0, error: "No eligible recipients." };

  const safeImageUrl = imageUrl && isSafeUrl(imageUrl) ? imageUrl : null;

  const result = await enqueueBulkForRecipients({
    recipients: users,
    type:       "NEW_EPISODE",
    campaignId,
    buildEmail: (r) => buildNewEpisodeEmail({
      recipientEmail: r.email,
      seriesTitle:    episode.parent!.title,
      seriesSlug:     episode.parent!.slug,
      episodeTitle:   episode.title,
      episodeNumber:  episode.episodeNumber,
      seasonNumber:   episode.seasonNumber,
      imageUrl:       safeImageUrl,
    }),
  });

  revalidatePath("/admin/outreach");
  return { queued: result.queued, suppressed: result.suppressed, skipped: result.skipped };
}
