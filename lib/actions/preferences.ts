"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

export type UserPreferencesData = {
  // Notification preferences
  inAppNotifications: boolean;
  emailNotifications: boolean;
  newReleaseNotifications: boolean;
  newEpisodeNotifications: boolean;
  announcementNotifications: boolean;
  studioUpdates: boolean;
  // Playback preferences
  autoplayNextEpisode: boolean;
  resumePlayback: boolean;
  reducedMotion: boolean;
};

const DEFAULTS: UserPreferencesData = {
  inAppNotifications: true,
  emailNotifications: false,
  newReleaseNotifications: true,
  newEpisodeNotifications: true,
  announcementNotifications: true,
  studioUpdates: true,
  autoplayNextEpisode: true,
  resumePlayback: true,
  reducedMotion: false,
};

/**
 * Get preferences for the current user.
 * Falls back to defaults if no record exists yet OR if the new columns
 * are not yet in the database (before db:push).
 */
export async function getUserPreferences(): Promise<UserPreferencesData> {
  const userId = await requireUser();

  try {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        inAppNotifications: true,
        emailNotifications: true,
        newReleaseNotifications: true,
        newEpisodeNotifications: true,
        announcementNotifications: true,
        studioUpdates: true,
        autoplayNextEpisode: true,
        resumePlayback: true,
        reducedMotion: true,
      },
    });

    if (!prefs) return DEFAULTS;

    return {
      inAppNotifications:        prefs.inAppNotifications        ?? DEFAULTS.inAppNotifications,
      emailNotifications:        prefs.emailNotifications        ?? DEFAULTS.emailNotifications,
      newReleaseNotifications:   prefs.newReleaseNotifications   ?? DEFAULTS.newReleaseNotifications,
      newEpisodeNotifications:   prefs.newEpisodeNotifications   ?? DEFAULTS.newEpisodeNotifications,
      announcementNotifications: prefs.announcementNotifications ?? DEFAULTS.announcementNotifications,
      studioUpdates:             prefs.studioUpdates             ?? DEFAULTS.studioUpdates,
      autoplayNextEpisode:       prefs.autoplayNextEpisode       ?? DEFAULTS.autoplayNextEpisode,
      resumePlayback:            prefs.resumePlayback            ?? DEFAULTS.resumePlayback,
      reducedMotion:             prefs.reducedMotion             ?? DEFAULTS.reducedMotion,
    };
  } catch {
    // New columns not yet in DB — return defaults until db:push
    return DEFAULTS;
  }
}

/**
 * Update preferences for the current user (upsert).
 * Skips new fields silently if the columns don't exist yet (before db:push).
 */
export async function updateUserPreferences(formData: FormData) {
  const userId = await requireUser();

  const bool = (key: string) => {
    const val = formData.get(key);
    // Unchecked checkbox sends nothing; checked sends "on"
    return val === "on" || val === "true" || val === "1";
  };

  const data = {
    inAppNotifications:        bool("inAppNotifications"),
    emailNotifications:        bool("emailNotifications"),
    newReleaseNotifications:   bool("newReleaseNotifications"),
    newEpisodeNotifications:   bool("newEpisodeNotifications"),
    announcementNotifications: bool("announcementNotifications"),
    studioUpdates:             bool("studioUpdates"),
    autoplayNextEpisode:       bool("autoplayNextEpisode"),
    resumePlayback:            bool("resumePlayback"),
    reducedMotion:             bool("reducedMotion"),
  };

  try {
    await prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  } catch {
    // New columns not in DB yet — skip silently until db:push
  }

  revalidatePath("/dashboard/settings");
}
