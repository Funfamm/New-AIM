import os from "os";
import path from "path";
import fs from "fs";
import https from "https";
import http from "http";
import { claimJob, reportProgress, completeJob, failJob } from "./api";
import { transcodeToHls } from "./ffmpeg";
import { uploadHlsDirectory, getPublicUrl } from "./r2";

export type ProcessResult =
  | { claimed: false }
  | { claimed: true; jobId: string; workTitle: string; succeeded: boolean; error?: string };

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    proto
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          file.destroy();
          fs.unlink(dest, () => {});
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const total = parseInt(res.headers["content-length"] ?? "0", 10);
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (total > 0) {
            const pct = Math.round((received / total) * 100);
            process.stdout.write(
              `\r[download] ${pct}% — ${(received / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`,
            );
          }
        });
        res.pipe(file);
        file.on("finish", () =>
          file.close(() => {
            process.stdout.write("\n");
            resolve();
          }),
        );
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

export async function processOne(): Promise<ProcessResult> {
  console.log("[worker] Claiming pending job...");
  const job = await claimJob();

  if (!job) {
    console.log("[worker] No pending jobs.");
    return { claimed: false };
  }

  console.log(`[worker] Claimed job: ${job.jobId}`);
  console.log(`[worker] Work:        "${job.workTitle ?? job.workId}"`);
  console.log(`[worker] Output:      ${job.outputPrefix}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aim-worker-"));
  const ext = path.extname(job.sourceKey) || ".mp4";
  const masterLocal = path.join(tmpDir, `master${ext}`);
  const hlsDir = path.join(tmpDir, "hls");

  try {
    await reportProgress(job.jobId, 10);

    console.log("[worker] Downloading master video...");
    await downloadFile(job.signedDownloadUrl, masterLocal);
    const mb = (fs.statSync(masterLocal).size / 1024 / 1024).toFixed(1);
    console.log(`[worker] Downloaded ${mb} MB`);
    await reportProgress(job.jobId, 20);

    console.log("[worker] Starting FFmpeg transcode (1080p / 720p / 480p)...");
    await reportProgress(job.jobId, 40);

    let lastSent = 40;
    await transcodeToHls(masterLocal, hlsDir, (ffPct) => {
      const workerPct = 40 + Math.round(ffPct * 0.3);
      if (workerPct >= lastSent + 5) {
        lastSent = workerPct;
        reportProgress(job.jobId, workerPct).catch(() => {});
      }
    });

    console.log("[worker] FFmpeg complete.");
    await reportProgress(job.jobId, 70);

    console.log(`[worker] Uploading HLS to R2 prefix: ${job.outputPrefix}`);
    await reportProgress(job.jobId, 85);

    const fileCount = await uploadHlsDirectory(hlsDir, job.outputPrefix);
    console.log(`[worker] Uploaded ${fileCount} files.`);
    await reportProgress(job.jobId, 95);

    const hlsUrl = getPublicUrl(`${job.outputPrefix}/master.m3u8`);
    console.log(`[worker] HLS URL: ${hlsUrl}`);
    await completeJob(job.jobId, hlsUrl);

    console.log("[worker] Job READY. Work.videoUrl updated automatically.");
    return {
      claimed: true,
      jobId: job.jobId,
      workTitle: job.workTitle ?? job.workId,
      succeeded: true,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker] ERROR: ${msg}`);
    await failJob(job.jobId, msg.slice(0, 400));
    return {
      claimed: true,
      jobId: job.jobId,
      workTitle: job.workTitle ?? job.workId,
      succeeded: false,
      error: msg,
    };

  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log("[worker] Temp files cleaned up.");
    } catch {
      // non-fatal
    }
  }
}
