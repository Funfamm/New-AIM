"use server";

// Admin actions for client website briefs. Every action verifies the admin role
// server-side and writes an audit entry.

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_RATES, RATE_LABELS, makeToken, normalizeRates, type Rates } from "@/lib/client-brief/schema";

const PATH = "/admin/client-briefs";

function field(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

/** Create a brief link for a client, pre-filled with what we already know about them. */
export async function createClientBrief(formData: FormData) {
  const admin = await requireAdmin();
  const club = field(formData, "club", 120);
  if (!club) redirect(`${PATH}?error=${encodeURIComponent("Enter the client's club or business name.")}`);

  const contactName = field(formData, "contactName", 120);
  const currentSite = field(formData, "currentSite", 300);
  const location    = field(formData, "location", 120);

  const answers: Record<string, string> = { club };
  if (contactName) answers.contact_name = contactName;
  if (currentSite) answers.current_site = currentSite;
  if (location)    answers.location     = location;

  const brief = await prisma.clientBrief.create({
    data: { token: makeToken(club), club, contactName: contactName || null, answers },
    select: { id: true },
  });
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "CLIENT_BRIEF_CREATE", targetId: brief.id, detail: club });
  revalidatePath(PATH);
  redirect(`${PATH}?id=${brief.id}&created=1`);
}

export async function saveClientBriefNotes(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id", 64);
  if (!id) return;
  const adminNotes = String(formData.get("adminNotes") ?? "").slice(0, 10_000);
  await prisma.clientBrief.update({ where: { id }, data: { adminNotes } }).catch(() => {});
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "CLIENT_BRIEF_NOTES", targetId: id });
  revalidatePath(PATH);
  redirect(`${PATH}?id=${id}&saved=notes`);
}

export async function deleteClientBrief(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id", 64);
  if (!id) return;
  const gone = await prisma.clientBrief.delete({ where: { id }, select: { club: true } }).catch(() => null);
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "CLIENT_BRIEF_DELETE", targetId: id, detail: gone?.club });
  revalidatePath(PATH);
  redirect(PATH);
}

/** Save the rate card that prices every brief. Inputs are named `rate.<key>` / `feature.<key>`. */
export async function saveClientBriefRates(formData: FormData) {
  const admin = await requireAdmin();
  const raw: Record<string, unknown> = { features: {} as Record<string, unknown> };
  for (const key of Object.keys(RATE_LABELS)) raw[key] = formData.get(`rate.${key}`);
  for (const key of Object.keys(DEFAULT_RATES.features)) {
    (raw.features as Record<string, unknown>)[key] = formData.get(`feature.${key}`);
  }
  // normalizeRates coerces every value to a number >= 0 and falls back to the default.
  const rates: Rates = normalizeRates(raw);
  await prisma.clientBriefConfig.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", rates: rates as object },
    update: { rates: rates as object },
  });
  void writeAudit({ actorId: admin.id ?? "", actorEmail: admin.email ?? "", action: "CLIENT_BRIEF_RATES" });
  revalidatePath(PATH);
  const id = field(formData, "id", 64);
  redirect(`${PATH}?${id ? `id=${id}&` : ""}saved=rates`);
}
