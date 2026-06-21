"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

function idFrom(formData: FormData): string {
  return String(formData.get("id") ?? "").trim();
}

export async function resolveError(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return;
  await prisma.errorLog.update({
    where: { id },
    data:  { resolved: true, resolvedAt: new Date(), resolvedBy: admin.id ?? null },
  }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_RESOLVE", targetId: id });
  revalidatePath("/admin/errors");
}

export async function reopenError(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return;
  await prisma.errorLog.update({
    where: { id },
    data:  { resolved: false, resolvedAt: null, resolvedBy: null },
  }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_REOPEN", targetId: id });
  revalidatePath("/admin/errors");
}

export async function deleteError(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return;
  await prisma.errorLog.delete({ where: { id } }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_DELETE", targetId: id });
  revalidatePath("/admin/errors");
}

export async function clearResolvedErrors() {
  const admin = await requireAdmin();
  const res = await prisma.errorLog.deleteMany({ where: { resolved: true } }).catch(() => ({ count: 0 }));
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_CLEAR_RESOLVED", detail: `${res.count} cleared` });
  revalidatePath("/admin/errors");
}
