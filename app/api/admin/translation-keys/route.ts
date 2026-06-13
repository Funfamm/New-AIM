import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { encryptSecret, maskSecret } from "@/lib/server/crypto";

function safeKey(k: {
  id: string; provider: string; name: string; keyPreview: string | null;
  isEnabled: boolean; status: string; taskScopes: string[];
  failureCount: number; successCount: number;
  lastUsedAt: Date | null; lastSuccessAt: Date | null; lastFailureAt: Date | null;
  cooldownUntil: Date | null; errorMessage: string | null;
  windowMaxCalls: number; usedInWindow: number; windowResetAt: Date | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: k.id,
    provider: k.provider,
    name: k.name,
    keyPreview: k.keyPreview,
    isEnabled: k.isEnabled,
    status: k.status,
    taskScopes: k.taskScopes,
    failureCount: k.failureCount,
    successCount: k.successCount,
    lastUsedAt: k.lastUsedAt,
    lastSuccessAt: k.lastSuccessAt,
    lastFailureAt: k.lastFailureAt,
    cooldownUntil: k.cooldownUntil,
    errorMessage: k.errorMessage,
    windowMaxCalls: k.windowMaxCalls,
    usedInWindow: k.usedInWindow,
    windowResetAt: k.windowResetAt,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  };
}

const VALID_SCOPES = new Set(["TRANSLATION", "CASTING_AUDITION"]);

function validateScopes(scopes: unknown): string[] {
  if (!Array.isArray(scopes) || scopes.length === 0) return ["TRANSLATION"];
  const valid = scopes.filter((s) => typeof s === "string" && VALID_SCOPES.has(s));
  return valid.length > 0 ? valid : ["TRANSLATION"];
}

// GET /api/admin/translation-keys
export async function GET() {
  await requireAdmin();
  const keys = await prisma.translationApiKey.findMany({
    orderBy: [{ createdAt: "asc" }],
  });
  return NextResponse.json({ keys: keys.map(safeKey) });
}

// POST /api/admin/translation-keys
// Body: { name, provider?, key, taskScopes? }
export async function POST(req: NextRequest) {
  await requireAdmin();

  const { name, provider = "gemini", key: rawKey, taskScopes } = await req.json() as {
    name?: string;
    provider?: string;
    key?: string;
    taskScopes?: unknown;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!rawKey?.trim()) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  let encryptedKey: string;
  try {
    encryptedKey = encryptSecret(rawKey.trim());
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("TRANSLATION_KEY_ENCRYPTION_SECRET")) {
      return NextResponse.json({ error: "Encryption secret not configured on server" }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to encrypt key" }, { status: 500 });
  }

  const created = await prisma.translationApiKey.create({
    data: {
      provider,
      name: name.trim(),
      encryptedKey,
      keyPreview: maskSecret(rawKey.trim()),
      taskScopes: validateScopes(taskScopes),
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ key: safeKey(created) }, { status: 201 });
}
