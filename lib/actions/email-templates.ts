"use server";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { EmailType } from "@prisma/client";

// System templates are critical auth/security flows — cannot be deleted.
// Only subjects and body can be edited; isActive is locked to true.
const SYSTEM_NAMES = new Set([
  "PASSWORD_RESET",
  "WELCOME",
  "SECURITY_ALERT",
]);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
}

export type TemplateResult = {
  error?: string;
  id?: string;
};

// ── List ──────────────────────────────────────────────────────────

export async function listTemplates() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  return prisma.emailTemplate.findMany({
    orderBy: [{ isSystem: "desc" }, { type: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, label: true, type: true,
      subject: true, isActive: true, isSystem: true,
      isDefault: true, updatedAt: true,
    },
  });
}

// ── Get one ───────────────────────────────────────────────────────

export async function getTemplate(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");
  return prisma.emailTemplate.findUnique({ where: { id } });
}

// ── Create ────────────────────────────────────────────────────────

export async function createTemplate(
  _prev: TemplateResult,
  formData: FormData,
): Promise<TemplateResult> {
  await requireAdmin();

  const raw         = (formData.get("name") as string ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const label       = (formData.get("label") as string ?? "").trim() || null;
  const description = (formData.get("description") as string ?? "").trim() || null;
  const type        = formData.get("type") as EmailType;
  const subject     = (formData.get("subject") as string ?? "").trim();
  const preheader   = (formData.get("preheader") as string ?? "").trim() || null;
  const bodyHtml    = (formData.get("bodyHtml") as string ?? "").trim();
  const bodyText    = (formData.get("bodyText") as string ?? "").trim() || null;

  if (!raw || !type || !subject || !bodyHtml) {
    return { error: "Key, type, subject, and HTML body are required." };
  }

  if (SYSTEM_NAMES.has(raw)) {
    return { error: `"${raw}" is a reserved system key. Choose a different key.` };
  }

  try {
    const t = await prisma.emailTemplate.create({
      data: {
        name: raw, label, description, type, subject,
        preheader, bodyHtml, bodyText,
        isActive: true, isSystem: false, isDefault: false,
      },
    });
    revalidatePath("/admin/email/templates");
    return { id: t.id };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return { error: "A template with that key already exists." };
    }
    return { error: "Failed to create template." };
  }
}

// ── Update ────────────────────────────────────────────────────────

export async function updateTemplate(
  _prev: TemplateResult,
  formData: FormData,
): Promise<TemplateResult> {
  await requireAdmin();

  const id          = formData.get("id") as string;
  const label       = (formData.get("label") as string ?? "").trim() || null;
  const description = (formData.get("description") as string ?? "").trim() || null;
  const subject     = (formData.get("subject") as string ?? "").trim();
  const preheader   = (formData.get("preheader") as string ?? "").trim() || null;
  const bodyHtml    = (formData.get("bodyHtml") as string ?? "").trim();
  const bodyText    = (formData.get("bodyText") as string ?? "").trim() || null;
  const isActive    = formData.get("isActive") === "1";

  if (!id || !subject || !bodyHtml) {
    return { error: "Subject and HTML body are required." };
  }

  const existing = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { name: true, isSystem: true },
  });
  if (!existing) return { error: "Template not found." };

  if (existing.isSystem && !isActive) {
    return { error: `${existing.name} is a system template and must remain active.` };
  }

  try {
    await prisma.emailTemplate.update({
      where: { id },
      data: { label, description, subject, preheader, bodyHtml, bodyText, isActive },
    });
    revalidatePath("/admin/email/templates");
    revalidatePath(`/admin/email/templates/${id}`);
    return {};
  } catch {
    return { error: "Failed to save template." };
  }
}

// ── Toggle active ─────────────────────────────────────────────────

export async function toggleTemplateActive(
  id: string,
  active: boolean,
): Promise<TemplateResult> {
  await requireAdmin();

  const t = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { name: true, isSystem: true },
  });
  if (!t) return { error: "Template not found." };
  if (t.isSystem && !active) {
    return { error: "System templates cannot be deactivated." };
  }

  await prisma.emailTemplate.update({ where: { id }, data: { isActive: active } });
  revalidatePath("/admin/email/templates");
  return {};
}

// ── Duplicate ─────────────────────────────────────────────────────

export async function duplicateTemplate(id: string): Promise<TemplateResult> {
  await requireAdmin();

  const src = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!src) return { error: "Template not found." };

  const newName = `${src.name}_COPY_${Date.now()}`;
  try {
    const dup = await prisma.emailTemplate.create({
      data: {
        name:        newName,
        label:       src.label ? `${src.label} (copy)` : null,
        description: src.description,
        type:        src.type,
        subject:     src.subject,
        preheader:   src.preheader,
        bodyHtml:    src.bodyHtml,
        bodyText:    src.bodyText,
        isActive:    false,
        isSystem:    false,
        isDefault:   false,
      },
    });
    revalidatePath("/admin/email/templates");
    return { id: dup.id };
  } catch {
    return { error: "Failed to duplicate template." };
  }
}

// ── Delete ────────────────────────────────────────────────────────

export async function deleteTemplate(id: string): Promise<TemplateResult> {
  await requireAdmin();

  const t = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { name: true, isSystem: true, isDefault: true },
  });
  if (!t) return { error: "Template not found." };
  if (t.isSystem || t.isDefault) {
    return { error: "System templates cannot be deleted. Deactivate them instead." };
  }

  await prisma.emailTemplate.delete({ where: { id } });
  revalidatePath("/admin/email/templates");
  return {};
}
