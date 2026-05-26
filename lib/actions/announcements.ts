"use server";

// Server actions for admin announcement management.
// Guards: requireAdmin() on every mutation.
// No secrets exposed. No client bundle.

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  return session.user;
}
import { createBulkInAppNotification } from "@/lib/notifications";
import { enqueueBulkForRecipients, buildAnnouncementEmail, isAcsConfigured } from "@/lib/bulk-email";
import type { NotificationType } from "@prisma/client";

// ── Create draft announcement ─────────────────────────────────
// Signature is compatible with React useActionState:
// (prevState: { error: string | undefined }, formData: FormData) => Promise<{ error: string | undefined }>

export async function createAnnouncement(
  _prevState: { error: string | undefined },
  formData: FormData,
): Promise<{ error: string | undefined }> {
  await requireAdmin();

  const title     = (formData.get("title")     as string | null)?.trim() ?? "";
  const body      = (formData.get("body")       as string | null)?.trim() ?? "";
  const href      = (formData.get("href")       as string | null)?.trim() || null;
  const hrefLabel = (formData.get("hrefLabel")  as string | null)?.trim() || null;
  const sendEmail = formData.get("sendEmail") === "on";
  const expiresRaw = formData.get("expiresAt") as string | null;

  if (!title) return { error: "Title is required." };
  if (!body)  return { error: "Body is required." };

  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && isNaN(expiresAt.getTime())) return { error: "Invalid expiry date." };

  await prisma.announcement.create({
    data: {
      title,
      body,
      href,
      hrefLabel,
      sendInApp: true,          // always true for now
      sendEmail,
      expiresAt,
      publishedAt: null,        // draft — not published yet
    },
  });

  revalidatePath("/admin/outreach");
  return { error: undefined };
}

// ── Publish announcement ──────────────────────────────────────
// Sets publishedAt and creates in-app notifications for all active users.
// If sendEmail = true and ACS is configured, queues bulk emails.

export async function publishAnnouncement(
  id: string,
): Promise<{ error?: string; created?: number; queued?: number }> {
  await requireAdmin();

  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement)         return { error: "Announcement not found." };
  if (announcement.publishedAt) return { error: "Already published." };

  // Mark published
  await prisma.announcement.update({
    where: { id },
    data:  { publishedAt: new Date() },
  });

  // In-app notification broadcast
  let created = 0;
  if (announcement.sendInApp) {
    const result = await createBulkInAppNotification({
      type:      announcement.type as NotificationType,
      title:     announcement.title,
      body:      announcement.body,
      href:      announcement.href ?? undefined,
      expiresAt: announcement.expiresAt ?? undefined,
    });
    created = result.created;
  }

  // Bulk email queue (ACS)
  let queued = 0;
  if (announcement.sendEmail) {
    if (!isAcsConfigured()) {
      // In-app was already sent — partial success
      revalidatePath("/admin/outreach");
      return {
        created,
        queued: 0,
        error: "In-app notifications sent, but bulk email provider (ACS) is not configured. Email not queued.",
      };
    }

    // Fetch all opted-in, active users with emails
    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        email:  { not: "" },
        OR: [
          { preferences: null },
          { preferences: { emailNotifications: true, announcementNotifications: true } },
        ],
      },
      select: { email: true, name: true },
    });

    const campaignId = `announcement_${id}`;
    const result = await enqueueBulkForRecipients({
      recipients: users,
      type:       "ANNOUNCEMENT",
      campaignId,
      buildEmail: (r) => buildAnnouncementEmail({
        recipientEmail: r.email,
        title:          announcement.title,
        body:           announcement.body,
        href:           announcement.href,
        hrefLabel:      announcement.hrefLabel,
      }),
    });

    // Mark email as dispatched
    await prisma.announcement.update({
      where: { id },
      data:  { emailSentAt: new Date() },
    });

    queued = result.queued;
  }

  revalidatePath("/admin/outreach");
  return { created, queued };
}

// ── Unpublish / archive ───────────────────────────────────────
// Sets publishedAt = null (back to draft). Does NOT delete notifications.

export async function unpublishAnnouncement(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  await prisma.announcement.update({
    where: { id },
    data:  { publishedAt: null },
  });

  revalidatePath("/admin/outreach");
  return {};
}

// ── Delete announcement ───────────────────────────────────────
// Hard delete. Does NOT delete Notification rows already sent.

export async function deleteAnnouncement(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  await prisma.announcement.delete({ where: { id } });

  revalidatePath("/admin/outreach");
  return {};
}
