import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/translation-keys/bulk-clear
// Body: { ids: string[] }
// Clears errors, cooldowns, and failure counts for the given key IDs.
// Only processes enabled keys — disabled keys are always skipped.
// Never touches encryptedKey, isEnabled, successCount, lastUsedAt, or lastSuccessAt.
export async function PATCH(req: NextRequest) {
  await requireAdmin();

  const body = await req.json() as { ids?: unknown };
  const ids  = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  if (!ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be strings" }, { status: 400 });
  }

  const result = await prisma.translationApiKey.updateMany({
    where: {
      id:        { in: ids as string[] },
      isEnabled: true,
    },
    data: {
      status:        "HEALTHY",
      failureCount:  0,
      cooldownUntil: null,
      errorMessage:  null,
      lastFailureAt: null,
      updatedAt:     new Date(),
    },
  });

  return NextResponse.json({ ok: true, cleared: result.count });
}
