import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { encryptSecret, maskSecret } from "@/lib/server/crypto";

function safeKey(k: {
  id: string; provider: string; name: string; keyPreview: string | null;
  isEnabled: boolean; status: string; failureCount: number; successCount: number;
  lastUsedAt: Date | null; lastSuccessAt: Date | null; lastFailureAt: Date | null;
  cooldownUntil: Date | null; errorMessage: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: k.id,
    provider: k.provider,
    name: k.name,
    keyPreview: k.keyPreview,       // already masked at creation time
    isEnabled: k.isEnabled,
    status: k.status,
    failureCount: k.failureCount,
    successCount: k.successCount,
    lastUsedAt: k.lastUsedAt,
    lastSuccessAt: k.lastSuccessAt,
    lastFailureAt: k.lastFailureAt,
    cooldownUntil: k.cooldownUntil,
    errorMessage: k.errorMessage,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  };
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
// Body: { name, provider?, key }
export async function POST(req: NextRequest) {
  await requireAdmin();

  const { name, provider = "gemini", key: rawKey } = await req.json() as {
    name?: string;
    provider?: string;
    key?: string;
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
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ key: safeKey(created) }, { status: 201 });
}
