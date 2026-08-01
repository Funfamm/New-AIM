import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPresignedUrl } from "@/lib/r2Client";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp",
]);
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a",
  "audio/wav", "audio/wave", "audio/x-wav",
  "audio/ogg", "audio/webm",
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB per image
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;  // 50 MB audio

// POST /api/casting/upload
// Body: { mediaType: "IMAGE" | "AUDIO", mimeType: string, fileSizeBytes: number, filename: string }
// Returns: { uploadUrl: string, r2Key: string }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await req.json() as {
    mediaType?:   string;
    mimeType?:    string;
    fileSizeBytes?: number;
    filename?:    string;
  };

  const { mediaType, mimeType, fileSizeBytes, filename } = body;

  if (!mediaType || !mimeType || !fileSizeBytes || !filename) {
    return NextResponse.json({ error: "mediaType, mimeType, fileSizeBytes, and filename are required." }, { status: 400 });
  }

  if (mediaType === "IMAGE") {
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "Invalid image format. Allowed: JPEG, PNG, WEBP." }, { status: 400 });
    }
    if (fileSizeBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be under 10 MB." }, { status: 400 });
    }
  } else if (mediaType === "AUDIO") {
    if (!ALLOWED_AUDIO_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "Invalid audio format. Allowed: MP3, M4A, WAV, OGG, WEBM." }, { status: 400 });
    }
    if (fileSizeBytes > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio must be under 50 MB." }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "mediaType must be IMAGE or AUDIO." }, { status: 400 });
  }

  // Build a private R2 key organised by sanitized email
  const ext          = filename.split(".").pop()?.toLowerCase() ?? "";
  const safeExt      = ext.replace(/[^a-z0-9]/g, "");
  const safeEmail    = (session.user.email ?? session.user.id)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const subFolder    = mediaType === "AUDIO" ? "audio" : "images";
  const ts           = Date.now();
  const rand         = Math.random().toString(36).slice(2, 7);
  const r2Key        = `private/casting/applicants/${safeEmail}/${ts}-${rand}/${subFolder}/${ts}.${safeExt}`;

  try {
    const uploadUrl = await getPresignedUrl(r2Key, mimeType, 600);
    return NextResponse.json({ uploadUrl, r2Key });
  } catch {
    return NextResponse.json({ error: "Could not generate upload URL. Check R2 configuration." }, { status: 500 });
  }
}
