"use server";
// Server Actions for Work CRUD — admin only

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { WorkType, WorkStatus } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
}

function parseFormData(formData: FormData) {
  const galleryRaw = (formData.get("galleryUrls") as string) ?? "";
  const galleryUrls = galleryRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    type:        formData.get("type") as WorkType,
    status:      formData.get("status") as WorkStatus,
    title:       ((formData.get("title") as string) ?? "").trim(),
    description: (formData.get("description") as string) || null,
    posterUrl:      (formData.get("posterUrl") as string)      || null,
    heroMobileUrl:  (formData.get("heroMobileUrl") as string)  || null,
    heroDesktopUrl: (formData.get("heroDesktopUrl") as string) || null,
    thumbnailUrl:   (formData.get("thumbnailUrl") as string)   || null,
    trailerUrl:     (formData.get("trailerUrl") as string)     || null,
    videoUrl:    (formData.get("videoUrl") as string)    || null,
    teaserUrl:   (formData.get("teaserUrl") as string)   || null,
    year:        formData.get("year")     ? Number(formData.get("year"))     : null,
    duration:    formData.get("duration") ? Number(formData.get("duration")) : null,
    director:    (formData.get("director") as string)    || null,
    genres:      (formData.getAll("genres") as string[]).filter(Boolean),
    clientName:  (formData.get("clientName") as string)  || null,
    industry:    (formData.get("industry") as string)    || null,
    projectGoal: (formData.get("projectGoal") as string) || null,
    deliverables:(formData.get("deliverables") as string)|| null,
    caseStudy:   (formData.get("caseStudy") as string)   || null,
    galleryUrls,
    requiresAuth:               formData.getAll("requiresAuth").includes("true"),
    requiresLoginToViewTrailer: formData.getAll("requiresLoginToViewTrailer").includes("true"),
    featured:     formData.getAll("featured").includes("true"),
    showOnHome:   formData.getAll("showOnHome").includes("true"),
    order:        formData.get("order") ? Number(formData.get("order")) : 0,
    parentId:     (formData.get("parentId") as string) || null,
    episodeNumber: formData.get("episodeNumber") ? Number(formData.get("episodeNumber")) : null,
    seasonNumber:  formData.get("seasonNumber")  ? Number(formData.get("seasonNumber"))  : null,
  };
}

function revalidateAll() {
  revalidatePath("/admin/works", "layout"); // covers list + all /admin/works/[id] pages
  revalidatePath("/works");
  revalidatePath("/");
}

// ── Create ────────────────────────────────────────────────────
export async function createWork(formData: FormData) {
  await requireAdmin();

  const data = parseFormData(formData);
  if (!data.title) {
    redirect("/admin/works/new?error=" + encodeURIComponent("Title is required."));
  }

  const slug = slugify(data.title);
  const existing = await prisma.work.findUnique({ where: { slug } });
  if (existing) {
    redirect("/admin/works/new?error=" + encodeURIComponent("A work with this title already exists."));
  }

  // Episodes inherit access from parent Series — never store a lock on the episode itself
  const createData = data.type === "EPISODE"
    ? { ...data, slug, requiresAuth: false, requiresLoginToViewTrailer: false }
    : { ...data, slug };

  await prisma.work.create({ data: createData });

  revalidateAll();
  // After creating an episode, return to the parent series edit page
  if (data.type === "EPISODE" && data.parentId) {
    redirect(`/admin/works/${data.parentId}`);
  }
  redirect("/admin/works");
}

// ── Update ────────────────────────────────────────────────────
export async function updateWork(id: string, formData: FormData) {
  await requireAdmin();

  const data = parseFormData(formData);

  // Episodes must never carry their own lock — clear it on every save
  const updateData = data.type === "EPISODE"
    ? { ...data, requiresAuth: false, requiresLoginToViewTrailer: false }
    : data;

  await prisma.work.update({ where: { id }, data: updateData });

  revalidateAll();
  // Stay on the edit page so admins can immediately see the episodes panel after saving
  redirect(`/admin/works/${id}`);
}

// ── Toggle published/private ──────────────────────────────────
export async function setWorkStatus(id: string, status: WorkStatus) {
  await requireAdmin();
  await prisma.work.update({ where: { id }, data: { status } });
  revalidateAll();
}

// ── Delete ────────────────────────────────────────────────────
export async function deleteWork(id: string) {
  await requireAdmin();
  await prisma.work.delete({ where: { id } });
  revalidateAll();
}
