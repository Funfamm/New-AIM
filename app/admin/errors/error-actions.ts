"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ErrorStatus } from "@prisma/client";

function idFrom(formData: FormData): string {
  return String(formData.get("id") ?? "").trim();
}

// `status` is the source of truth. (The legacy `resolved` boolean is being retired —
// step 1 of the two-step drop stops writing it here; resolvedAt/resolvedBy stay.)
function statusPatch(status: ErrorStatus, adminId: string | null) {
  const resolving = status === "RESOLVED";
  return {
    status,
    resolvedAt: resolving ? new Date() : null,
    resolvedBy: resolving ? adminId : null,
    ...(status === "MUTED" ? {} : { mutedUntil: null }),
  };
}

function revalidate(id?: string) {
  revalidatePath("/admin/errors");
  if (id) revalidatePath(`/admin/errors/${id}`);
}

export async function resolveError(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return;
  await prisma.errorLog.update({ where: { id }, data: statusPatch("RESOLVED", admin.id ?? null) }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_RESOLVE", targetId: id });
  revalidate(id);
}

export async function reopenError(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return;
  await prisma.errorLog.update({ where: { id }, data: statusPatch("NEW", admin.id ?? null) }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_REOPEN", targetId: id });
  revalidate(id);
}

const SETTABLE = new Set<ErrorStatus>(["NEW", "ACKNOWLEDGED", "RESOLVED", "IGNORED"]);

export async function setErrorStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  const status = String(formData.get("status") ?? "") as ErrorStatus;
  if (!id || !SETTABLE.has(status)) return;
  await prisma.errorLog.update({ where: { id }, data: statusPatch(status, admin.id ?? null) }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: `ERROR_STATUS_${status}`, targetId: id });
  revalidate(id);
}

export async function muteError(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return;
  const hours = Math.min(24 * 30, Math.max(1, Number(formData.get("hours")) || 24));
  await prisma.errorLog.update({
    where: { id },
    data:  { status: "MUTED", mutedUntil: new Date(Date.now() + hours * 3_600_000), resolvedAt: null, resolvedBy: null },
  }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_MUTE", targetId: id, detail: `${hours}h` });
  revalidate(id);
}

export async function assignError(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return;
  const unassign = String(formData.get("action") ?? "") === "unassign";
  await prisma.errorLog.update({
    where: { id },
    data:  unassign
      ? { assignedToId: null, assignedToEmail: null }
      : { assignedToId: admin.id ?? null, assignedToEmail: admin.email ?? null },
  }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: unassign ? "ERROR_UNASSIGN" : "ERROR_ASSIGN", targetId: id });
  revalidate(id);
}

export async function addErrorNote(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (!id || !body) return;
  await prisma.errorNote.create({
    data: { errorId: id, authorId: admin.id ?? "", authorEmail: admin.email ?? "", body },
  }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_NOTE", targetId: id });
  revalidate(id);
}

export async function deleteError(formData: FormData) {
  const admin = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return;
  await prisma.errorLog.delete({ where: { id } }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_DELETE", targetId: id });
  const fromDetail = String(formData.get("from") ?? "") === "detail";
  revalidatePath("/admin/errors");
  if (fromDetail) redirect("/admin/errors");
}

export async function clearResolvedErrors() {
  const admin = await requireAdmin();
  const res = await prisma.errorLog.deleteMany({ where: { status: "RESOLVED" } }).catch(() => ({ count: 0 }));
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "ERROR_CLEAR_RESOLVED", detail: `${res.count} cleared` });
  revalidatePath("/admin/errors");
}
