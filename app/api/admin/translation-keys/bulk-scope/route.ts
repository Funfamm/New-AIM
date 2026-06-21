import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const VALID_SCOPES = new Set(["TRANSLATION", "CASTING_AUDITION"]);

// PATCH /api/admin/translation-keys/bulk-scope
// Body: { ids: string[], taskScopes: string[] }
export async function PATCH(req: NextRequest) {
  await requireAdmin();

  const body = await req.json() as { ids?: unknown; taskScopes?: unknown };

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (!body.ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be strings" }, { status: 400 });
  }

  const scopes = Array.isArray(body.taskScopes)
    ? (body.taskScopes as unknown[]).filter((s): s is string => typeof s === "string" && VALID_SCOPES.has(s))
    : [];

  if (scopes.length === 0) {
    return NextResponse.json({ error: "taskScopes must include at least one valid scope" }, { status: 400 });
  }

  const result = await prisma.translationApiKey.updateMany({
    where: { id: { in: body.ids as string[] } },
    data: { taskScopes: scopes, updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
