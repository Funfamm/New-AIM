"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { runAuditionReview } from "@/lib/casting/casting-ai-client";
import {
  sendCastingReceived,
  sendCastingRequirementsNotMet,
  sendCastingReadyForReview,
  sendCastingShortlisted,
  sendCastingContacted,
  sendCastingSelected,
  sendCastingNotSelected,
  sendCastingWithdrawn,
} from "@/lib/casting/casting-emails";
import type {
  CastingApplicationStatus,
} from "@prisma/client";

const POLICY_VERSION = "1.0";

// Statuses from which withdrawal is still allowed
const WITHDRAWABLE_STATUSES: CastingApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_AGENT_REVIEW",
];

// Statuses admin can set as a final decision
const ADMIN_DECISION_STATUSES: CastingApplicationStatus[] = [
  "SHORTLISTED",
  "CONTACTED",
  "SELECTED",
  "NOT_SELECTED",
];

// ── Public helpers ────────────────────────────────────────────

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

async function getCastingSettings() {
  const settings = await prisma.adminSettings.findFirst({
    select: { showCasting: true, castingBackgroundUrl: true },
  });
  return {
    enabled: settings?.showCasting ?? false,
    backgroundUrl: settings?.castingBackgroundUrl ?? null,
  };
}

// ── Public: fetch open roles grouped by Work ──────────────────

export type PublicCastingRole = {
  id: string; slug: string; title: string; description: string; isOpen: boolean;
  requireGender: boolean; allowedGender: string | null;
  requireAgeRange: boolean; minAge: number | null; maxAge: number | null;
  requireVoiceSample: boolean;
  applicationCount: number;
  work: { id: string; title: string; slug: string; posterUrl: string | null } | null;
};

export type PublicCastingGroup = {
  work: { id: string; title: string; slug: string; posterUrl: string | null } | null;
  roles: PublicCastingRole[];
};

export async function getPublicCastingRoles(): Promise<{
  enabled: boolean;
  backgroundUrl: string | null;
  groups: PublicCastingGroup[];
}> {
  const { enabled, backgroundUrl } = await getCastingSettings();
  if (!enabled) return { enabled: false, backgroundUrl: null, groups: [] };

  const roles = await prisma.castingRole.findMany({
    where: { isOpen: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, slug: true, title: true, description: true, isOpen: true,
      requireGender: true, allowedGender: true,
      requireAgeRange: true, minAge: true, maxAge: true,
      requireVoiceSample: true,
      _count: { select: { applications: true } },
      work: { select: { id: true, title: true, slug: true, posterUrl: true } },
    },
  });

  // Group by workId (null = "General Casting")
  const groupMap = new Map<string | null, PublicCastingGroup>();

  for (const r of roles) {
    const key = r.work?.id ?? null;
    if (!groupMap.has(key)) {
      groupMap.set(key, { work: r.work ?? null, roles: [] });
    }
    groupMap.get(key)!.roles.push({
      id: r.id, slug: r.slug, title: r.title, description: r.description,
      isOpen: r.isOpen, requireGender: r.requireGender, allowedGender: r.allowedGender,
      requireAgeRange: r.requireAgeRange, minAge: r.minAge, maxAge: r.maxAge,
      requireVoiceSample: r.requireVoiceSample,
      applicationCount: r._count.applications,
      work: r.work ?? null,
    });
  }

  // Projects first, then general (null) at end
  const groups: PublicCastingGroup[] = [];
  for (const [key, group] of groupMap) {
    if (key !== null) groups.push(group);
  }
  if (groupMap.has(null)) groups.push(groupMap.get(null)!);

  return { enabled: true, backgroundUrl, groups };
}

// ── Public: works with open casting roles (for badges) ───────

export async function getWorksWithOpenCastingRoles(): Promise<Set<string>> {
  const roles = await prisma.castingRole.findMany({
    where: { isOpen: true, workId: { not: null } },
    select: { workId: true },
  });
  return new Set(roles.map((r) => r.workId!));
}

// ── Public: fetch a single role ───────────────────────────────

export async function getPublicCastingRole(slug: string) {
  const { enabled } = await getCastingSettings();
  if (!enabled) return null;

  return prisma.castingRole.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, description: true, isOpen: true,
      requireGender: true, allowedGender: true,
      requireAgeRange: true, minAge: true, maxAge: true,
      requireVoiceSample: true,
      work: { select: { id: true, title: true, slug: true, posterUrl: true } },
    },
  });
}

// ── Public: applicant tracking ────────────────────────────────

export async function getApplicationTracking(token: string) {
  if (!token) return null;

  const app = await prisma.castingApplication.findUnique({
    where: { trackingToken: token },
    select: {
      id: true,
      status: true,
      createdAt: true,
      withdrawnAt: true,
      requirementsReason: true,
      role: { select: { title: true, slug: true } },
    },
  });

  if (!app) return null;

  const canWithdraw = WITHDRAWABLE_STATUSES.includes(app.status);

  const nextStepMessages: Record<CastingApplicationStatus, string> = {
    SUBMITTED:             "Your application has been received. Our team will begin the review process shortly.",
    UNDER_AGENT_REVIEW:    "Your submission is currently being reviewed for completeness and quality.",
    READY_FOR_ADMIN_REVIEW: "Your application has passed initial review and is now with our casting team.",
    REQUIREMENTS_NOT_MET:  "Your submission requires updates before it can proceed to review. Please check the details below.",
    SHORTLISTED:           "You have been shortlisted. Our team will be in touch with you soon.",
    CONTACTED:             "Our team has reached out to you. Please check your email and respond.",
    SELECTED:              "Congratulations — you have been selected. Our team will contact you with next steps.",
    NOT_SELECTED:          "We have proceeded with another candidate for this role. Thank you for your interest.",
    WITHDRAWN:             "You have withdrawn your application.",
  };

  return {
    ...app,
    canWithdraw,
    nextStepMessage: nextStepMessages[app.status],
  };
}

// ── Auth: check if user already applied for a role ────────────

export async function getUserApplicationForRole(roleId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.castingApplication.findUnique({
    where: { userId_roleId: { userId: session.user.id, roleId } },
    select: { id: true, status: true, trackingToken: true },
  });
}

// ── Auth: submit application ──────────────────────────────────

export type SubmitApplicationInput = {
  roleId:       string;
  name:         string;
  location:     string;
  socialHandle: string;
  roleInterest: string;
  shortNote:    string;
  gender?:      string;
  ageRange?:    string;
  // Media r2Keys recorded after upload
  imageKeys:    { r2Key: string; mimeType: string; fileSizeBytes: number; originalFilename?: string }[];
  audioKey?:    { r2Key: string; mimeType: string; fileSizeBytes: number; durationSeconds?: number; originalFilename?: string };
  // Policy
  consentAccepted:         boolean;
  policyAccepted:          boolean;
  isAdultConfirmed:        boolean;
  unpaidAccepted:          boolean;
  likenessReleaseAccepted: boolean;
  withdrawalTermsAccepted: boolean;
};

export async function submitCastingApplication(
  input: SubmitApplicationInput,
): Promise<{ ok: boolean; trackingToken?: string; error?: string }> {
  const user = await requireAuth();

  const { enabled } = await getCastingSettings();
  if (!enabled) return { ok: false, error: "Casting is currently closed." };

  // Validate role exists and is open
  const role = await prisma.castingRole.findUnique({
    where: { id: input.roleId },
    select: { id: true, isOpen: true, title: true, requireVoiceSample: true, work: { select: { posterUrl: true } } },
  });
  if (!role || !role.isOpen) return { ok: false, error: "This role is not currently accepting applications." };

  // Check duplicate
  const existing = await prisma.castingApplication.findUnique({
    where: { userId_roleId: { userId: user.id, roleId: input.roleId } },
    select: { id: true, status: true },
  });
  if (existing) return { ok: false, error: "You have already applied for this role." };

  // Policy checks
  if (!input.consentAccepted)         return { ok: false, error: "You must accept the consent terms." };
  if (!input.policyAccepted)          return { ok: false, error: "You must accept the Casting Policy." };
  if (!input.isAdultConfirmed)        return { ok: false, error: "You must confirm you are 18 or older." };
  if (!input.unpaidAccepted)          return { ok: false, error: "You must acknowledge this is an unpaid opportunity." };
  if (!input.likenessReleaseAccepted) return { ok: false, error: "You must accept the Likeness Release terms." };
  if (!input.withdrawalTermsAccepted) return { ok: false, error: "You must accept the withdrawal policy terms." };

  // Image requirements: 4–6
  if (input.imageKeys.length < 4) return { ok: false, error: "Please upload at least 4 images." };
  if (input.imageKeys.length > 6) return { ok: false, error: "Maximum 6 images allowed." };

  // Audio requirements (if required)
  if (role.requireVoiceSample && !input.audioKey) {
    return { ok: false, error: "An audio sample is required for this role." };
  }
  if (input.audioKey?.durationSeconds != null) {
    const dur = input.audioKey.durationSeconds;
    if (dur < 60)  return { ok: false, error: "Audio sample must be at least 1 minute long." };
    if (dur > 180) return { ok: false, error: "Audio sample must not exceed 3 minutes." };
  }

  // Required fields
  if (!input.name.trim())         return { ok: false, error: "Name is required." };
  if (!input.location.trim())     return { ok: false, error: "Location is required." };
  if (!input.socialHandle.trim()) return { ok: false, error: "Social media handle is required." };
  if (!input.shortNote.trim())    return { ok: false, error: "Short note is required." };

  const now = new Date();
  const hdrs = await headers();

  // Create application + media in a transaction
  const application = await prisma.castingApplication.create({
    data: {
      userId:                 user.id,
      roleId:                 input.roleId,
      name:                   input.name.trim(),
      email:                  user.email!,
      location:               input.location.trim(),
      socialHandle:           input.socialHandle.trim(),
      roleInterest:           input.roleInterest.trim(),
      shortNote:              input.shortNote.trim(),
      gender:                 input.gender?.trim() || null,
      ageRange:               input.ageRange?.trim() || null,
      consentAccepted:        true,
      policyAccepted:         true,
      isAdultConfirmed:       true,
      unpaidAccepted:         true,
      likenessReleaseAccepted: true,
      withdrawalTermsAccepted: true,
      policyVersion:          POLICY_VERSION,
      policyAcceptedAt:       now,
      releaseAcceptedAt:      now,
      consentAt:              now,
      ipAddress:              hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? null,
      userAgent:              hdrs.get("user-agent")?.slice(0, 500) ?? null,
      status:                 "SUBMITTED",
      media: {
        create: [
          ...input.imageKeys.map((img, i) => ({
            type:             "IMAGE" as const,
            r2Key:            img.r2Key,
            mimeType:         img.mimeType,
            fileSizeBytes:    img.fileSizeBytes,
            originalFilename: img.originalFilename ?? null,
            sortOrder:        i,
          })),
          ...(input.audioKey ? [{
            type:             "AUDIO" as const,
            r2Key:            input.audioKey.r2Key,
            mimeType:         input.audioKey.mimeType,
            fileSizeBytes:    input.audioKey.fileSizeBytes,
            durationSeconds:  input.audioKey.durationSeconds ?? null,
            originalFilename: input.audioKey.originalFilename ?? null,
            sortOrder:        0,
          }] : []),
        ],
      },
    },
    select: { id: true, trackingToken: true },
  });

  // Send confirmation email (non-blocking)
  sendCastingReceived({
    to:            user.email!,
    name:          input.name.trim(),
    roleTitle:     role.title,
    trackingToken: application.trackingToken,
    posterUrl:     role.work?.posterUrl ?? null,
  }).catch(() => {});

  // Trigger agent review in background (non-blocking)
  triggerAgentReview(application.id).catch(() => {});

  revalidatePath("/casting");

  return { ok: true, trackingToken: application.trackingToken };
}

// ── Auth: withdraw application ────────────────────────────────

export async function withdrawApplication(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();

  const app = await prisma.castingApplication.findUnique({
    where: { trackingToken: token },
    select: { id: true, userId: true, status: true, name: true, email: true, role: { select: { title: true, work: { select: { posterUrl: true } } } } },
  });

  if (!app) return { ok: false, error: "Application not found." };
  if (app.userId !== user.id) return { ok: false, error: "Not authorised." };
  if (!WITHDRAWABLE_STATUSES.includes(app.status)) {
    return { ok: false, error: "Withdrawal is no longer available once your application is under review." };
  }

  await prisma.castingApplication.update({
    where: { id: app.id },
    data: { status: "WITHDRAWN", withdrawnAt: new Date(), updatedAt: new Date() },
  });

  sendCastingWithdrawn({ to: app.email, name: app.name, roleTitle: app.role.title, posterUrl: app.role.work?.posterUrl ?? null }).catch(() => {});

  revalidatePath(`/casting/applications/track/${token}`);
  return { ok: true };
}

// ── Agent: trigger review ─────────────────────────────────────

export async function triggerAgentReview(applicationId: string): Promise<void> {
  const app = await prisma.castingApplication.findUnique({
    where: { id: applicationId },
    include: {
      role: { include: { work: { select: { posterUrl: true } } } },
      media: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!app) return;
  if (app.status !== "SUBMITTED") return; // only review freshly submitted apps

  // Mark as under review
  await prisma.castingApplication.update({
    where: { id: applicationId },
    data: { status: "UNDER_AGENT_REVIEW", reviewStartedAt: new Date(), updatedAt: new Date() },
  });

  const images = app.media.filter((m) => m.type === "IMAGE");
  const audio  = app.media.find((m) => m.type === "AUDIO");

  const result = await runAuditionReview({
    applicationId:       app.id,
    roleTitle:           app.role.title,
    roleDescription:     app.role.description,
    requireGender:       app.role.requireGender,
    allowedGender:       app.role.allowedGender,
    requireAgeRange:     app.role.requireAgeRange,
    minAge:              app.role.minAge,
    maxAge:              app.role.maxAge,
    requireVoiceSample:  app.role.requireVoiceSample,
    name:                app.name,
    location:            app.location,
    socialHandle:        app.socialHandle,
    roleInterest:        app.roleInterest,
    shortNote:           app.shortNote,
    gender:              app.gender,
    ageRange:            app.ageRange,
    imageCount:          images.length,
    imageMimeTypes:      images.map((m) => m.mimeType),
    audioCount:          audio ? 1 : 0,
    audioDurationSeconds: audio?.durationSeconds ?? null,
    consentAccepted:          app.consentAccepted,
    policyAccepted:           app.policyAccepted,
    isAdultConfirmed:         app.isAdultConfirmed,
    unpaidAccepted:           app.unpaidAccepted,
    likenessReleaseAccepted:  app.likenessReleaseAccepted,
    withdrawalTermsAccepted:  app.withdrawalTermsAccepted,
  });

  if ("error" in result) {
    // Revert to SUBMITTED so it can be retried
    await prisma.castingApplication.update({
      where: { id: applicationId },
      data: { status: "SUBMITTED", reviewStartedAt: null, updatedAt: new Date() },
    });
    return;
  }

  // Store agent review
  await prisma.castingAgentReview.create({
    data: {
      applicationId:  applicationId,
      overallScore:   result.overallScore,
      photoScore:     result.photoScore,
      voiceScore:     result.voiceScore,
      socialScore:    result.socialScore,
      formScore:      result.formScore,
      recommendation: result.recommendation,
      summary:        result.summary,
      imageReview:    result.imageReview,
      audioReview:    result.audioReview,
      socialResult:   result.socialResult,
      roleMatchResult: result.roleMatchResult,
      suggestedAction: result.suggestedAction,
      missingItems:   result.missingItems,
      scoreBreakdown: result.scoreBreakdown as object ?? undefined,
    },
  });

  // Decide next status based on score vs role threshold
  const meetsThreshold = result.overallScore >= app.role.minAgentScore;

  if (meetsThreshold) {
    await prisma.castingApplication.update({
      where: { id: applicationId },
      data: {
        status:          "READY_FOR_ADMIN_REVIEW",
        readyForReviewAt: new Date(),
        updatedAt:       new Date(),
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
      select: { email: true },
    });
    for (const admin of admins) {
      if (admin.email) {
        sendCastingReadyForReview({
          adminEmail:    admin.email,
          applicantName: app.name,
          roleTitle:     app.role.title,
          applicationId: app.id,
          score:         result.overallScore,
          posterUrl:     app.role.work?.posterUrl ?? null,
        }).catch(() => {});
      }
    }
  } else {
    const canResubmit = app.resubmissionCount < 2;

    await prisma.castingApplication.update({
      where: { id: applicationId },
      data: {
        status:             "REQUIREMENTS_NOT_MET",
        requirementsReason: result.missingItems.join("; ") || result.summary,
        updatedAt:          new Date(),
      },
    });

    sendCastingRequirementsNotMet({
      to:            app.email,
      name:          app.name,
      roleTitle:     app.role.title,
      reasons:       result.missingItems,
      trackingToken: app.trackingToken,
      canResubmit,
      posterUrl:     app.role.work?.posterUrl ?? null,
    }).catch(() => {});
  }

  revalidatePath("/admin/casting");
}

// ── Admin: list applications ──────────────────────────────────

export type ApplicationFilter = {
  status?:         string;
  roleId?:         string;
  minScore?:       number;
  recommendation?: string;
  search?:         string;
};

export async function adminGetApplications(filter: ApplicationFilter = {}) {
  await requireAdmin();

  const where: Record<string, unknown> = {};

  if (filter.status && filter.status !== "ALL") {
    where.status = filter.status as CastingApplicationStatus;
  }
  if (filter.roleId) {
    where.roleId = filter.roleId;
  }
  if (filter.search) {
    where.OR = [
      { name:         { contains: filter.search, mode: "insensitive" } },
      { email:        { contains: filter.search, mode: "insensitive" } },
      { socialHandle: { contains: filter.search, mode: "insensitive" } },
    ];
  }
  if (filter.minScore != null || filter.recommendation) {
    where.agentReview = {};
    if (filter.minScore != null) {
      (where.agentReview as Record<string, unknown>).overallScore = { gte: filter.minScore };
    }
    if (filter.recommendation && filter.recommendation !== "ALL") {
      (where.agentReview as Record<string, unknown>).recommendation = filter.recommendation;
    }
  }

  const applications = await prisma.castingApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, trackingToken: true, name: true, email: true, status: true,
      location: true, socialHandle: true, createdAt: true, withdrawnAt: true,
      role: { select: { id: true, title: true, slug: true } },
      agentReview: {
        select: { overallScore: true, recommendation: true, summary: true, completedAt: true },
      },
    },
  });

  return applications;
}

// ── Admin: get single application detail ──────────────────────

export async function adminGetApplication(id: string) {
  await requireAdmin();

  return prisma.castingApplication.findUnique({
    where: { id },
    include: {
      role: true,
      media: { orderBy: { sortOrder: "asc" } },
      agentReview: true,
      notes: {
        orderBy: { createdAt: "asc" },
        include: { admin: { select: { name: true, email: true } } },
      },
    },
  });
}

// ── Admin: update status ──────────────────────────────────────

export async function adminUpdateApplicationStatus(
  applicationId: string,
  newStatus: CastingApplicationStatus,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();

  if (!ADMIN_DECISION_STATUSES.includes(newStatus)) {
    return { ok: false, error: "Invalid status for admin decision." };
  }

  const app = await prisma.castingApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true, name: true, email: true, status: true, trackingToken: true,
      role: { select: { title: true, work: { select: { posterUrl: true } } } },
    },
  });
  if (!app) return { ok: false, error: "Application not found." };

  await prisma.castingApplication.update({
    where: { id: applicationId },
    data: {
      status:       newStatus,
      decisionAt:   new Date(),
      decisionById: admin.id,
      decisionReason: reason ?? null,
      updatedAt:    new Date(),
    },
  });

  // Send decision emails
  const emailArgs = { to: app.email, name: app.name, roleTitle: app.role.title, posterUrl: app.role.work?.posterUrl ?? null };
  if (newStatus === "SHORTLISTED") {
    sendCastingShortlisted({ ...emailArgs, trackingToken: app.trackingToken }).catch(() => {});
  } else if (newStatus === "CONTACTED") {
    sendCastingContacted({ ...emailArgs, trackingToken: app.trackingToken }).catch(() => {});
  } else if (newStatus === "SELECTED") {
    sendCastingSelected({ ...emailArgs, trackingToken: app.trackingToken }).catch(() => {});
  } else if (newStatus === "NOT_SELECTED") {
    sendCastingNotSelected(emailArgs).catch(() => {});
  }

  revalidatePath("/admin/casting");
  revalidatePath(`/admin/casting/${applicationId}`);
  return { ok: true };
}

// ── Admin: add note ───────────────────────────────────────────

export async function adminAddNote(
  applicationId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();

  if (!body.trim()) return { ok: false, error: "Note cannot be empty." };

  await prisma.castingApplicationNote.create({
    data: {
      applicationId,
      adminId: admin.id,
      body:    body.trim().slice(0, 2000),
    },
  });

  revalidatePath(`/admin/casting/${applicationId}`);
  return { ok: true };
}

// ── Admin: retrigger agent review ─────────────────────────────

export async function adminRetriggerReview(
  applicationId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const app = await prisma.castingApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true },
  });

  if (!app) return { ok: false, error: "Application not found." };

  // Delete existing review so it can be recreated
  await prisma.castingAgentReview.deleteMany({ where: { applicationId } });

  // Reset to submitted so triggerAgentReview will process it
  await prisma.castingApplication.update({
    where: { id: applicationId },
    data: {
      status:           "SUBMITTED",
      reviewStartedAt:  null,
      readyForReviewAt: null,
      updatedAt:        new Date(),
    },
  });

  revalidatePath(`/admin/casting/${applicationId}`);

  // Run in background
  triggerAgentReview(applicationId).catch(() => {});

  return { ok: true };
}

// ── Admin: get all roles ──────────────────────────────────────

export async function adminGetRoles() {
  await requireAdmin();

  return prisma.castingRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { applications: true } },
      work: { select: { id: true, title: true, slug: true, posterUrl: true } },
    },
  });
}

// ── Admin: get works list for role form select ────────────────

export async function adminGetWorksForSelect() {
  await requireAdmin();

  return prisma.work.findMany({
    where: { status: { in: ["PUBLISHED", "UPCOMING", "IN_PRODUCTION", "DRAFT"] }, type: { not: "EPISODE" } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, posterUrl: true },
  });
}

// ── Admin: create role ────────────────────────────────────────

export type RoleInput = {
  slug:               string;
  title:              string;
  description:        string;
  isOpen:             boolean;
  workId?:            string;
  requireGender:      boolean;
  allowedGender?:     string;
  requireAgeRange:    boolean;
  minAge?:            number;
  maxAge?:            number;
  requireVoiceSample: boolean;
  minAgentScore:      number;
  sortOrder:          number;
};

export async function adminCreateRole(
  input: RoleInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requireAdmin();

  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (!input.slug.trim())  return { ok: false, error: "Slug is required." };
  if (!input.description.trim()) return { ok: false, error: "Description is required." };

  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

  try {
    const role = await prisma.castingRole.create({
      data: {
        slug,
        title:              input.title.trim(),
        description:        input.description.trim(),
        isOpen:             input.isOpen,
        workId:             input.workId || null,
        requireGender:      input.requireGender,
        allowedGender:      input.allowedGender?.trim() || null,
        requireAgeRange:    input.requireAgeRange,
        minAge:             input.minAge ?? null,
        maxAge:             input.maxAge ?? null,
        requireVoiceSample: input.requireVoiceSample,
        minAgentScore:      Math.max(0, Math.min(100, input.minAgentScore)),
        sortOrder:          input.sortOrder,
      },
    });

    revalidatePath("/admin/casting/roles");
    revalidatePath("/casting");
    return { ok: true, id: role.id };
  } catch {
    return { ok: false, error: "Slug already in use. Choose a different slug." };
  }
}

// ── Admin: update role ────────────────────────────────────────

export async function adminUpdateRole(
  id: string,
  input: Partial<RoleInput>,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  try {
    const slug = input.slug
      ? input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : undefined;

    await prisma.castingRole.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(input.title ? { title: input.title.trim() } : {}),
        ...(input.description != null ? { description: input.description.trim() } : {}),
        ...(input.isOpen != null ? { isOpen: input.isOpen } : {}),
        ...("workId" in input ? { workId: input.workId || null } : {}),
        ...(input.requireGender != null ? { requireGender: input.requireGender } : {}),
        ...(input.allowedGender != null ? { allowedGender: input.allowedGender.trim() || null } : {}),
        ...(input.requireAgeRange != null ? { requireAgeRange: input.requireAgeRange } : {}),
        ...(input.minAge != null ? { minAge: input.minAge } : {}),
        ...(input.maxAge != null ? { maxAge: input.maxAge } : {}),
        ...(input.requireVoiceSample != null ? { requireVoiceSample: input.requireVoiceSample } : {}),
        ...(input.minAgentScore != null ? { minAgentScore: Math.max(0, Math.min(100, input.minAgentScore)) } : {}),
        ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
        updatedAt: new Date(),
      },
    });

    revalidatePath("/admin/casting/roles");
    revalidatePath("/casting");
    return { ok: true };
  } catch {
    return { ok: false, error: "Update failed. Slug may already be in use." };
  }
}

// ── Admin: delete role ────────────────────────────────────────

export async function adminDeleteRole(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const count = await prisma.castingApplication.count({ where: { roleId: id } });
  if (count > 0) {
    return { ok: false, error: `Cannot delete — this role has ${count} application${count !== 1 ? "s" : ""}. Close it instead.` };
  }

  await prisma.castingRole.delete({ where: { id } });

  revalidatePath("/admin/casting/roles");
  revalidatePath("/casting");
  return { ok: true };
}

// ── Admin: export applications as CSV ────────────────────────

export async function adminExportCastingCSV(filter: ApplicationFilter = {}): Promise<string> {
  await requireAdmin();

  const apps = await adminGetApplications(filter);

  const rows = [
    ["ID", "Name", "Email", "Role", "Status", "Score", "Recommendation", "Location", "Social Handle", "Submitted"].join(","),
    ...apps.map((a) => [
      a.id,
      csvEscape(a.name),
      csvEscape(a.email),
      csvEscape(a.role.title),
      a.status,
      a.agentReview?.overallScore ?? "",
      a.agentReview?.recommendation ?? "",
      csvEscape(a.location),
      csvEscape(a.socialHandle),
      a.createdAt.toISOString(),
    ].join(",")),
  ];

  return rows.join("\n");
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
