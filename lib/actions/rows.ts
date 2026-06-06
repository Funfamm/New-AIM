"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import type { RowPlacement } from "@prisma/client";

// ── Helper: Sanitize slug ────────────────────────────────────────────────────
function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ── Admin: Get all rows ──────────────────────────────────────────────────────
export async function getRows(): Promise<
  Array<{
    id: string;
    title: string;
    slug: string;
    placement: RowPlacement;
    active: boolean;
    sortOrder: number;
    itemCount: number;
  }>
> {
  await requireAdmin();

  const rows = await prisma.contentRow.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      placement: true,
      active: true,
      sortOrder: true,
      items: { select: { id: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    placement: row.placement,
    active: row.active,
    sortOrder: row.sortOrder,
    itemCount: row.items.length,
  }));
}

// ── Admin: Get row by ID with items ──────────────────────────────────────────
export async function getRowById(rowId: string): Promise<{
  id: string;
  title: string;
  slug: string;
  description: string | null;
  placement: RowPlacement;
  active: boolean;
  sortOrder: number;
  items: Array<{
    id: string;
    workId: string;
    sortOrder: number;
    work: { id: string; title: string; type: string; slug: string };
  }>;
} | null> {
  await requireAdmin();

  return prisma.contentRow.findUnique({
    where: { id: rowId },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      placement: true,
      active: true,
      sortOrder: true,
      items: {
        select: {
          id: true,
          workId: true,
          sortOrder: true,
          work: { select: { id: true, title: true, type: true, slug: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

// ── Admin: Create row ────────────────────────────────────────────────────────
export async function createRow(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string; rowId?: string }> {
  await requireAdmin();

  const title = ((formData.get("title") as string) ?? "").trim();
  const slug = ((formData.get("slug") as string) ?? "").trim() || sanitizeSlug(title);
  const description = ((formData.get("description") as string) ?? "").trim() || null;
  const placement = (formData.get("placement") as RowPlacement) || "HOME";

  if (!title) return { ok: false, error: "Title is required." };
  if (!["HOME", "WORKS", "BOTH"].includes(placement))
    return { ok: false, error: "Invalid placement." };

  // Check slug uniqueness
  const existing = await prisma.contentRow.findUnique({ where: { slug } });
  if (existing) return { ok: false, error: "This slug is already in use." };

  try {
    const row = await prisma.contentRow.create({
      data: {
        title,
        slug,
        description,
        placement,
      },
    });

    revalidatePath("/admin/rows");
    return { ok: true, rowId: row.id };
  } catch (err) {
    console.error("[createRow] Error:", err);
    return { ok: false, error: "Failed to create row." };
  }
}

// ── Admin: Update row ────────────────────────────────────────────────────────
export async function updateRow(
  rowId: string,
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const title = ((formData.get("title") as string) ?? "").trim();
  const description = ((formData.get("description") as string) ?? "").trim() || null;
  const placement = (formData.get("placement") as RowPlacement) || "HOME";
  const active = formData.get("active") === "1";
  const sortOrder = parseInt(formData.get("sortOrder") as string, 10) || 0;

  if (!title) return { ok: false, error: "Title is required." };
  if (!["HOME", "WORKS", "BOTH"].includes(placement))
    return { ok: false, error: "Invalid placement." };

  try {
    await prisma.contentRow.update({
      where: { id: rowId },
      data: { title, description, placement, active, sortOrder },
    });

    revalidatePath("/admin/rows");
    revalidatePath("/");
    revalidatePath("/works");
    return { ok: true };
  } catch (err) {
    console.error("[updateRow] Error:", err);
    return { ok: false, error: "Failed to update row." };
  }
}

// ── Admin: Delete row (actually deletes, cascades to items) ──────────────────
export async function deleteRow(rowId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  try {
    await prisma.contentRow.delete({ where: { id: rowId } });

    revalidatePath("/admin/rows");
    revalidatePath("/");
    revalidatePath("/works");
    return { ok: true };
  } catch (err) {
    console.error("[deleteRow] Error:", err);
    return { ok: false, error: "Failed to delete row." };
  }
}

// ── Admin: Deactivate row (soft delete via active flag) ──────────────────────
export async function setRowActive(
  rowId: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  try {
    await prisma.contentRow.update({ where: { id: rowId }, data: { active } });

    revalidatePath("/admin/rows");
    revalidatePath("/");
    revalidatePath("/works");
    return { ok: true };
  } catch (err) {
    console.error("[setRowActive] Error:", err);
    return { ok: false, error: "Failed to update row status." };
  }
}

// ── Admin: Add work to row ───────────────────────────────────────────────────
export async function addWorkToRow(
  rowId: string,
  workId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  // Verify row exists
  const row = await prisma.contentRow.findUnique({ where: { id: rowId } });
  if (!row) return { ok: false, error: "Row not found." };

  // Verify work exists
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work) return { ok: false, error: "Work not found." };

  // Get next sortOrder
  const lastItem = await prisma.contentRowItem.findFirst({
    where: { rowId },
    orderBy: { sortOrder: "desc" },
  });
  const nextSortOrder = (lastItem?.sortOrder ?? -1) + 10;

  try {
    await prisma.contentRowItem.create({
      data: {
        rowId,
        workId,
        sortOrder: nextSortOrder,
      },
    });

    revalidatePath("/admin/rows");
    revalidatePath("/");
    revalidatePath("/works");
    return { ok: true };
  } catch (err) {
    const error = err as any;
    if (error.code === "P2002")
      return { ok: false, error: "Work is already in this row." };
    console.error("[addWorkToRow] Error:", err);
    return { ok: false, error: "Failed to add work to row." };
  }
}

// ── Admin: Remove work from row ──────────────────────────────────────────────
export async function removeWorkFromRow(
  rowId: string,
  workId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  try {
    await prisma.contentRowItem.delete({
      where: { rowId_workId: { rowId, workId } },
    });

    revalidatePath("/admin/rows");
    revalidatePath("/");
    revalidatePath("/works");
    return { ok: true };
  } catch (err) {
    console.error("[removeWorkFromRow] Error:", err);
    return { ok: false, error: "Failed to remove work from row." };
  }
}

// ── Admin: Update work order inside row ──────────────────────────────────────
export async function updateRowItemOrder(
  rowId: string,
  items: Array<{ workId: string; sortOrder: number }>
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  try {
    await Promise.all(
      items.map((item) =>
        prisma.contentRowItem.update({
          where: { rowId_workId: { rowId, workId: item.workId } },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    revalidatePath("/admin/rows");
    revalidatePath("/");
    revalidatePath("/works");
    return { ok: true };
  } catch (err) {
    console.error("[updateRowItemOrder] Error:", err);
    return { ok: false, error: "Failed to update work order." };
  }
}

// ── Admin: Update row sort order (reorder rows) ──────────────────────────────
export async function updateRowSortOrder(
  rows: Array<{ id: string; sortOrder: number }>
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  try {
    await Promise.all(
      rows.map((row) =>
        prisma.contentRow.update({
          where: { id: row.id },
          data: { sortOrder: row.sortOrder },
        })
      )
    );

    revalidatePath("/admin/rows");
    revalidatePath("/");
    revalidatePath("/works");
    return { ok: true };
  } catch (err) {
    console.error("[updateRowSortOrder] Error:", err);
    return { ok: false, error: "Failed to update row order." };
  }
}
