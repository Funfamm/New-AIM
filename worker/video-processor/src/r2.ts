import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_BASE_URL,
} from "./config";
import fs from "fs";
import path from "path";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_BASE_URL}/${key}`;
}

function contentType(key: string): string {
  if (key.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (key.endsWith(".ts"))   return "video/mp2t";
  return "application/octet-stream";
}

function cacheControl(key: string): string {
  // Playlists must not be cached so players always get updated state
  if (key.endsWith(".m3u8")) return "public, max-age=0";
  // Segments are immutable — aggressive caching is fine
  return "public, max-age=31536000, immutable";
}

export async function uploadHlsDirectory(
  localDir: string,
  outputPrefix: string,
): Promise<number> {
  const c = getClient();

  // Collect every file recursively
  const files: Array<{ localPath: string; r2Key: string }> = [];

  function collect(dir: string, keyPrefix: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const localPath = path.join(dir, entry.name);
      const r2Key = `${keyPrefix}/${entry.name}`;
      if (entry.isDirectory()) collect(localPath, r2Key);
      else files.push({ localPath, r2Key });
    }
  }
  collect(localDir, outputPrefix);

  const total = files.length;
  let uploaded = 0;

  // Upload in parallel batches of 10
  const BATCH = 10;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async ({ localPath, r2Key }) => {
        await c.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: r2Key,
            Body: fs.createReadStream(localPath),
            ContentLength: fs.statSync(localPath).size,
            ContentType: contentType(r2Key),
            CacheControl: cacheControl(r2Key),
          }),
        );
        uploaded++;
        process.stdout.write(`\r[r2] ${uploaded}/${total} uploaded...`);
      }),
    );
  }
  process.stdout.write(`\r[r2] ${total}/${total} files uploaded.   \n`);
  return total;
}
