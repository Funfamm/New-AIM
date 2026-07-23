import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getPublicUrl } from "@/lib/r2Client";
import type { SubtitleSegment } from "./subtitle-file-parser";

const BUCKET = process.env.R2_BUCKET_NAME!;

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

function secondsToVttTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ms = Math.round((sec % 1) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(Math.floor(sec), 2)}.${pad(ms, 3)}`;
}

export function segmentsToVtt(segments: SubtitleSegment[]): string {
  const cues = segments
    .map(
      (seg, i) =>
        `${i + 1}\n${secondsToVttTime(seg.start)} --> ${secondsToVttTime(seg.end)}\n${seg.text}`
    )
    .join("\n\n");
  return `WEBVTT\n\n${cues}`;
}

function hash8(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export async function cacheVttToR2(
  subtitleId: string,
  lang: string,
  segments: SubtitleSegment[]
): Promise<string> {
  const vttContent = segmentsToVtt(segments);
  const h = hash8(vttContent + lang);
  const key = `subtitles/${subtitleId}/${lang}-${h}.vtt`;

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: vttContent,
      ContentType: "text/vtt",
      CacheControl: "public, max-age=86400",
    })
  );

  return key;
}

export function getVttUrl(lang: string, vttKeys: Record<string, string>): string | null {
  const key = vttKeys[lang];
  if (!key) return null;
  return getPublicUrl(key);
}

export async function cacheAllLanguageVtts(
  subtitleId: string,
  translations: Record<string, SubtitleSegment[]>
): Promise<Record<string, string>> {
  const keys: Record<string, string> = {};
  await Promise.all(
    Object.entries(translations).map(async ([lang, segs]) => {
      keys[lang] = await cacheVttToR2(subtitleId, lang, segs);
    })
  );
  return keys;
}
