import { APP_BASE_URL, WORKER_SECRET } from "./config";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${WORKER_SECRET}`,
});

export type ClaimedJob = {
  jobId: string;
  workId: string;
  sourceKey: string;
  outputPrefix: string;
  signedDownloadUrl: string;
  workSlug: string | null;
  workTitle: string | null;
};

export async function claimJob(): Promise<ClaimedJob | null> {
  const res = await fetch(`${APP_BASE_URL}/api/worker/video-processing/claim`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Claim endpoint returned ${res.status}`);
  const data = (await res.json()) as { job: ClaimedJob | null };
  return data.job;
}

export async function reportProgress(jobId: string, progress: number): Promise<void> {
  const res = await fetch(
    `${APP_BASE_URL}/api/worker/video-processing/${jobId}/progress`,
    { method: "POST", headers: headers(), body: JSON.stringify({ progress }) },
  );
  if (!res.ok) console.warn(`[progress] ${res.status} — continuing`);
}

export async function completeJob(jobId: string, hlsUrl: string): Promise<void> {
  const res = await fetch(
    `${APP_BASE_URL}/api/worker/video-processing/${jobId}/complete`,
    { method: "POST", headers: headers(), body: JSON.stringify({ hlsUrl }) },
  );
  if (!res.ok) throw new Error(`Complete endpoint returned ${res.status}`);
}

export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  try {
    const res = await fetch(
      `${APP_BASE_URL}/api/worker/video-processing/${jobId}/fail`,
      { method: "POST", headers: headers(), body: JSON.stringify({ errorMessage }) },
    );
    if (!res.ok) console.error(`[fail] endpoint returned ${res.status}`);
  } catch (err) {
    console.error("[fail] Could not reach fail endpoint:", (err as Error).message);
  }
}
