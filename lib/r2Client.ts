import { S3Client, PutObjectCommand, GetObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error('[r2Client] Missing required Cloudflare R2 environment variables.');
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
}

export async function getPresignedUrl(key: string, contentType: string, expiresIn: number = 600): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

export function getPublicUrl(key: string): string {
  const baseUrl = (process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('[r2Client] R2_PUBLIC_BASE_URL is not set. Cannot construct a public URL.');
  }
  return `${baseUrl}/${key}`;
}

export async function initMultipartUpload(key: string, contentType: string): Promise<string> {
  const client = getS3Client();
  const command = new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  const response = await client.send(command);
  if (!response.UploadId) throw new Error('Failed to initialize multipart upload');
  return response.UploadId;
}

export async function getPartPresignedUrl(key: string, uploadId: string, partNumber: number, expiresIn: number = 600): Promise<string> {
  const client = getS3Client();
  const command = new UploadPartCommand({
    Bucket: R2_BUCKET_NAME!,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>
): Promise<void> {
  const client = getS3Client();
  const command = new CompleteMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME!,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });

  await client.send(command);
}

/**
 * Server-only. Returns a temporary signed GET URL for a private R2 object.
 * Used by the background worker to download master video files.
 * Never expose this URL to public users.
 */
export async function getDownloadPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME!,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const client = getS3Client();
  const command = new AbortMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME!,
    Key: key,
    UploadId: uploadId,
  });

  await client.send(command);
}
