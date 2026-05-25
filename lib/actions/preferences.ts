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

/** Get preferences for the current user. Returns defaults if no record exists yet. */
export async function getUserPreferences(): Promise<UserPreferencesData> {
  const userId = await requireUser();

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
    inAppNotifications: prefs.inAppNotifications ?? DEFAULTS.inAppNotifications,
    emailNotifications: prefs.emailNotifications ?? DEFAULTS.emailNotifications,
    newReleaseNotifications: prefs.newReleaseNotifications ?? DEFAULTS.newReleaseNotifications,
    newEpisodeNotifications: prefs.newEpisodeNotifications ?? DEFAULTS.newEpisodeNotifications,
    announcementNotifications: prefs.announcementNotifications ?? DEFAULTS.announcementNotifications,
    studioUpdates: prefs.studioUpdates ?? DEFAULTS.studioUpdates,
    autoplayNextEpisode: prefs.autoplayNextEpisode ?? DEFAULTS.autoplayNextEpisode,
    resumePlayback: prefs.resumePlayback ?? DEFAULTS.resumePlayback,
    reducedMotion: prefs.reducedMotion ?? DEFAULTS.reducedMotion,
  };
}

/** Update preferences for the current user (upsert). Called from a Server Action form. */
export async function updateUserPreferences(formData: FormData) {
  const userId = await requireUser();

  const bool = (key: string, defaultVal: boolean) => {
    const val = formData.get(key);
    if (val === null) return defaultVal; // unchecked checkbox sends nothing
    return val === "on" || val === "true" || val === "1";
  };

  // Checkboxes send "on" when checked, nothing when unchecked.
  // We pass the field default so unchecked boxes correctly save false.
  const data = {
    inAppNotifications: bool("inAppNotifications", false),
    emailNotifications: bool("emailNotifications", false),
    newReleaseNotifications: bool("newReleaseNotifications", false),
    newEpisodeNotifications: bool("newEpisodeNotifications", false),
    announcementNotifications: bool("announcementNotifications", false),
    studioUpdates: bool("studioUpdates", false),
    autoplayNextEpisode: bool("autoplayNextEpisode", false),
    resumePlayback: bool("resumePlayback", false),
    reducedMotion: bool("reducedMotion", false),
  };

  await prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  revalidatePath("/dashboard/settings");
}
