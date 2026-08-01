import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const VALID_SCOPES = new Set(["TRANSLATION", "CASTING_AUDITION"]);

// PATCH /api/admin/translation-keys/[id]
// Body: { action: "enable" | "disable" | "reset" | "setScope", taskScopes?: string[] }
export async function PATCH(req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json() as { action?: string; taskScopes?: unknown };
  const { action } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const key = await prisma.translationApiKey.findUnique({ where: { id } });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let data: Record<string, unknown> = { updatedAt: new Date() };

  if (action === "enable") {
    data = { isEnabled: true, status: key.status === "INVALID" ? "HEALTHY" : key.status, updatedAt: new Date() };
  } else if (action === "disable") {
    data = { isEnabled: false, updatedAt: new Date() };
  } else if (action === "reset") {
    data = {
      status: "HEALTHY",
      isEnabled: true,
      failureCount: 0,
      cooldownUntil: null,
      errorMessage: null,
      usedInWindow: 0,
      windowResetAt: null,
      updatedAt: new Date(),
    };
  } else if (action === "setScope") {
    const scopes = Array.isArray(body.taskScopes)
      ? (body.taskScopes as unknown[]).filter((s): s is string => typeof s === "string" && VALID_SCOPES.has(s))
      : [];
    if (scopes.length === 0) {
      return NextResponse.json({ error: "taskScopes must include at least one valid scope" }, { status: 400 });
    }
    data = { taskScopes: scopes, updatedAt: new Date() };
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await prisma.translationApiKey.update({ where: { id }, data });
  return NextResponse.json({ ok: true, status: updated.status, isEnabled: updated.isEnabled, taskScopes: updated.taskScopes });
}

// DELETE /api/admin/translation-keys/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  await requireAdmin();
  const { id } = await params;

  const key = await prisma.translationApiKey.findUnique({ where: { id } });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.translationApiKey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
