"use server";
// Server Actions for film CRUD — admin only
// All mutations verify ADMIN role before proceeding

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

// ── Create film ───────────────────────────────────────────────
export async function createFilm(formData: FormData) {
  await requireAdmin();

  const title = formData.get("title") as string;
  if (!title?.trim()) return { error: "Title is required." };

  const slug = slugify(title);

  // Ensure slug is unique
  const existing = await prisma.film.findUnique({ where: { slug } });
  if (existing) return { error: "A film with this title already exists." };

  await prisma.film.create({
    data: {
      title: title.trim(),
      slug,
      description: (formData.get("description") as string) || null,
      posterUrl:   (formData.get("posterUrl") as string)   || null,
      trailerUrl:  (formData.get("trailerUrl") as string)  || null,
      filmUrl:     (formData.get("filmUrl") as string)     || null,
      isPublic:    formData.get("isPublic") === "true",
      requiresAuth: formData.get("requiresAuth") !== "false",
      year:        formData.get("year") ? Number(formData.get("year")) : null,
      duration:    formData.get("duration") ? Number(formData.get("duration")) : null,
      genre:       (formData.get("genre") as string) || null,
      director:    (formData.get("director") as string) || null,
    },
  });

  revalidatePath("/admin/films");
  revalidatePath("/works");
  return { success: true };
}

// ── Update film ───────────────────────────────────────────────
export async function updateFilm(id: string, formData: FormData) {
  await requireAdmin();

  await prisma.film.update({
    where: { id },
    data: {
      title:       (formData.get("title") as string)       || undefined,
      description: (formData.get("description") as string) || null,
      posterUrl:   (formData.get("posterUrl") as string)   || null,
      trailerUrl:  (formData.get("trailerUrl") as string)  || null,
      filmUrl:     (formData.get("filmUrl") as string)     || null,
      isPublic:    formData.get("isPublic") === "true",
      requiresAuth: formData.get("requiresAuth") !== "false",
      year:        formData.get("year") ? Number(formData.get("year")) : null,
      duration:    formData.get("duration") ? Number(formData.get("duration")) : null,
      genre:       (formData.get("genre") as string) || null,
      director:    (formData.get("director") as string) || null,
    },
  });

  revalidatePath("/admin/films");
  revalidatePath("/works");
  return { success: true };
}

// ── Toggle visibility ─────────────────────────────────────────
export async function toggleFilmVisibility(id: string, isPublic: boolean) {
  await requireAdmin();
  await prisma.film.update({ where: { id }, data: { isPublic } });
  revalidatePath("/admin/films");
  revalidatePath("/works");
}

// ── Delete film ───────────────────────────────────────────────
export async function deleteFilm(id: string) {
  await requireAdmin();
  await prisma.film.delete({ where: { id } });
  revalidatePath("/admin/films");
  revalidatePath("/works");
}
