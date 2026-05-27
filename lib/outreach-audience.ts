// lib/outreach-audience.ts
// Shared audience-resolution helpers.
// NOT a "use server" file — these are server-only DB utilities, not Server Actions.
// Used by lib/actions/outreach.ts, lib/actions/announcements.ts, and cron routes.

import { prisma } from "@/lib/prisma";

// ── In-app audience ───────────────────────────────────────────
// Returns user IDs who should receive an in-app notification for the given audience.
// Filters out users who have inAppNotifications disabled.

export async function resolveInAppAudience(
  audienceType: string,
  specificIds?: string[],
): Promise<string[]> {
  const base = { status: "ACTIVE" as const };
  const inAppOr = [
    { preferences: null as object | null },
    { preferences: { inAppNotifications: true } },
  ];

  if (audienceType === "specific") {
    if (!specificIds || specificIds.length === 0) return [];
    const users = await prisma.user.findMany({
      where: { ...base, id: { in: specificIds }, OR: inAppOr },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  if (audienceType === "admins") {
    const users = await prisma.user.findMany({
      where: { ...base, role: "ADMIN", OR: inAppOr },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  if (audienceType === "notify_me") {
    // Notify-me signups may not be registered users — cross-reference by email.
    const signups = await prisma.notifyMeSignup.findMany({
      select:   { email: true },
      distinct: ["email"],
    });
    const emails = signups.map((s) => s.email);
    if (emails.length === 0) return [];
    const users = await prisma.user.findMany({
      where: { ...base, email: { in: emails }, OR: inAppOr },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  if (audienceType === "saved_work") {
    const users = await prisma.user.findMany({
      where: { ...base, savedWorks: { some: {} }, OR: inAppOr },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  // "all" or any other value (release_default, episode_default, etc.)
  const users = await prisma.user.findMany({
    where: { ...base, OR: inAppOr },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// ── Email audience ────────────────────────────────────────────
// Returns { email, name }[] for the given audience.
// Filters by email opt-in preferences for mass sends.
// "specific" sends bypass the opt-in filter (admin explicitly chose these users).

export async function resolveEmailAudience(
  audienceType: string,
  specificIds?: string[],
): Promise<{ email: string; name: string | null }[]> {
  const base = {
    status: "ACTIVE" as const,
    email:  { not: "" },
  };

  if (audienceType === "specific") {
    if (!specificIds || specificIds.length === 0) return [];
    return prisma.user.findMany({
      where:  { ...base, id: { in: specificIds } },
      select: { email: true, name: true },
    });
  }

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

  // "all" (or release_default / episode_default)
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

// ── New Release email audience ────────────────────────────────
// Same as resolveEmailAudience("all") but respects emailNewReleases preference.

export async function resolveReleaseEmailAudience(
  audienceType: string,
  specificIds?: string[],
): Promise<{ email: string; name: string | null }[]> {
  const base = {
    status: "ACTIVE" as const,
    email:  { not: "" },
  };

  if (audienceType === "specific") {
    if (!specificIds || specificIds.length === 0) return [];
    return prisma.user.findMany({
      where:  { ...base, id: { in: specificIds } },
      select: { email: true, name: true },
    });
  }

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
          { preferences: { emailNewReleases: true, newReleaseNotifications: true } },
        ],
      },
      select: { email: true, name: true },
    });
  }

  // "all" or release_default
  return prisma.user.findMany({
    where: {
      ...base,
      OR: [
        { preferences: null },
        { preferences: { emailNewReleases: true, newReleaseNotifications: true } },
      ],
    },
    select: { email: true, name: true },
  });
}

// ── Episode / Season Drop email audience ──────────────────────
// Respects newEpisodeNotifications preference.

export async function resolveEpisodeEmailAudience(
  audienceType: string,
  specificIds?: string[],
): Promise<{ email: string; name: string | null }[]> {
  const base = {
    status: "ACTIVE" as const,
    email:  { not: "" },
  };

  if (audienceType === "specific") {
    if (!specificIds || specificIds.length === 0) return [];
    return prisma.user.findMany({
      where:  { ...base, id: { in: specificIds } },
      select: { email: true, name: true },
    });
  }

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
          { preferences: { newEpisodeNotifications: true } },
        ],
      },
      select: { email: true, name: true },
    });
  }

  // "all" or episode_default
  return prisma.user.findMany({
    where: {
      ...base,
      OR: [
        { preferences: null },
        { preferences: { newEpisodeNotifications: true } },
      ],
    },
    select: { email: true, name: true },
  });
}
