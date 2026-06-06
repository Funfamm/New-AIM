'use client';

import { useState, useRef } from 'react';
import { Upload, X, CheckCircle2 } from 'lucide-react';

const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

interface UploadProps {
  targetField: string;
  projectTitle: string;
  projectSlug?: string;
  onSuccess: (urlOrKey: string) => void;
  onError?: (error: string) => void;
  accept?: string;
  /** When true, calls onSuccess with the R2 object key instead of a public URL.
   *  Use for masterVideoKey uploads where no public URL exists. */
  returnKey?: boolean;
}

export default function R2FileUpload({
  targetField,
  projectTitle,
  projectSlug,
  onSuccess,
  onError,
  accept = 'image/*',
  returnKey = false,
}: UploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess(false);
    setUploading(true);
    setProgress(0);

    try {
      const isLargeFile = file.size > MULTIPART_THRESHOLD;

      if (isLargeFile) {
        await uploadMultipart(file);
      } else {
        await uploadSingleFile(file);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      onError?.(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  async function uploadSingleFile(file: File) {
    const presignRes = await fetch('/api/admin/r2/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetField,
        projectTitle,
        projectSlug,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      }),
    });

    if (!presignRes.ok) {
      const data = await presignRes.json();
      throw new Error(data.error || 'Failed to get upload URL');
    }

    const { presignedUrl, publicUrl, r2Key } = await presignRes.json();

    const uploadRes = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!uploadRes.ok) throw new Error('Upload to R2 failed');

    setProgress(100);
    setSuccess(true);
    onSuccess(returnKey ? r2Key : publicUrl);
  }

  async function uploadMultipart(file: File) {
    // Initialize multipart upload
    const initRes = await fetch('/api/admin/r2/upload/multipart/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetField,
        projectTitle,
        projectSlug,
        filename: file.name,
        contentType: file.type,
      }),
    });

    if (!initRes.ok) {
      const data = await initRes.json();
      throw new Error(data.error || 'Failed to initialize multipart upload');
    }

    const { uploadId: id, r2Key, publicUrl } = await initRes.json();
    setUploadId(id);

    // Split file into parts
    const parts: Array<{ PartNumber: number; ETag: string }> = [];
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const partNumber = i + 1;

      // Get presigned URL for this part
      const signRes = await fetch('/api/admin/r2/upload/multipart/sign-part', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r2Key,
          uploadId: id,
          partNumber,
        }),
      });

      if (!signRes.ok) throw new Error('Failed to sign part URL');
      const { presignedUrl } = await signRes.json();

      // Upload part
      const partRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: chunk,
      });

      if (!partRes.ok) throw new Error(`Part ${partNumber} upload failed`);

      const etag = partRes.headers.get('ETag') || '';
      parts.push({ PartNumber: partNumber, ETag: etag });

      // Update progress
      setProgress(Math.round(((i + 1) / totalParts) * 100));
    }

    // Complete multipart upload
    const completeRes = await fetch('/api/admin/r2/upload/multipart/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        r2Key,
        uploadId: id,
        parts,
      }),
    });

    if (!completeRes.ok) throw new Error('Failed to complete upload');

    setProgress(100);
    setSuccess(true);
    setUploadId(null);
    onSuccess(returnKey ? r2Key : publicUrl);
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />

      {error && (
        <div className="flex items-start gap-2 rounded bg-brand-red/10 p-3 text-sm text-brand-red">
          <X className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded bg-green-500/10 p-3 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>Upload complete</span>
        </div>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-brand-border overflow-hidden">
            <div
              className="h-full bg-brand-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-brand-muted">{progress}%</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={uploading || success}
        className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-brand-light bg-brand-surface hover:bg-brand-border disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Upload className="h-4 w-4" />
        {success ? 'Upload complete' : uploading ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  );
}
