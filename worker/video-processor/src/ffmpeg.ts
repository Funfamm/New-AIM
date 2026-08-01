import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// Normalize path separators for FFmpeg (always forward slashes)
function fp(p: string): string {
  return p.replace(/\\/g, "/");
}

export function checkFfmpeg(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("FFmpeg not found or could not run. Install FFmpeg and ensure it is in PATH."));
    });
    proc.on("error", () =>
      reject(new Error("FFmpeg not found. Install FFmpeg and ensure it is in PATH.")),
    );
  });
}

export function transcodeToHls(
  inputPath: string,
  outputDir: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true });

  const segPattern = fp(path.join(outputDir, "%v", "seg_%04d.ts"));
  const playlistPattern = fp(path.join(outputDir, "%v", "index.m3u8"));

  const args = [
    "-y",
    "-i", inputPath,

    // Split video into 3 independent streams, scale each
    "-filter_complex",
    "[0:v]split=3[v1][v2][v3];" +
    "[v1]scale=-2:1080[v1out];" +
    "[v2]scale=-2:720[v2out];" +
    "[v3]scale=-2:480[v3out]",

    // 1080p
    "-map", "[v1out]", "-map", "0:a:0",
    "-c:v:0", "libx264", "-preset:v:0", "medium",
    "-crf:v:0", "20", "-maxrate:v:0", "5350k", "-bufsize:v:0", "10700k",
    "-c:a:0", "aac", "-b:a:0", "128k", "-ac:a:0", "2",

    // 720p
    "-map", "[v2out]", "-map", "0:a:0",
    "-c:v:1", "libx264", "-preset:v:1", "medium",
    "-crf:v:1", "22", "-maxrate:v:1", "2996k", "-bufsize:v:1", "5992k",
    "-c:a:1", "aac", "-b:a:1", "128k", "-ac:a:1", "2",

    // 480p
    "-map", "[v3out]", "-map", "0:a:0",
    "-c:v:2", "libx264", "-preset:v:2", "medium",
    "-crf:v:2", "24", "-maxrate:v:2", "1284k", "-bufsize:v:2", "2568k",
    "-c:a:2", "aac", "-b:a:2", "128k", "-ac:a:2", "2",

    // HLS muxer
    "-f", "hls",
    "-hls_time", "6",
    "-hls_playlist_type", "vod",
    "-hls_flags", "independent_segments",
    "-hls_segment_type", "mpegts",
    "-hls_segment_filename", segPattern,
    "-var_stream_map", "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p",
    "-master_pl_name", "master.m3u8",
    playlistPattern,
  ];

  return new Promise((resolve, reject) => {
    console.log("[ffmpeg] Spawning transcode (1080p + 720p + 480p)...");
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });

    let stderrChunks = "";
    let lastPct = -1;
    let durationSecs = 0;
    let stderrBuf = "";

    proc.stderr?.on("data", (chunk: Buffer) => {
      const s = chunk.toString();
      stderrChunks += s;
      stderrBuf += s;

      // Process complete lines for progress
      const lines = stderrBuf.split(/\r|\n/);
      stderrBuf = lines.pop() ?? "";

      for (const line of lines) {
        // Parse total duration once
        if (durationSecs === 0) {
          const m = line.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
          if (m) {
            durationSecs =
              parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
          }
        }

        // Parse current encoding position
        const tm = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (tm && durationSecs > 0) {
          const timeSecs =
            parseInt(tm[1]) * 3600 + parseInt(tm[2]) * 60 + parseFloat(tm[3]);
          const pct = Math.min(99, Math.round((timeSecs / durationSecs) * 100));
          if (pct > lastPct) {
            lastPct = pct;
            onProgress(pct);
          }
        }
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const tail = stderrChunks.split("\n").slice(-8).join(" | ").slice(0, 500);
        reject(new Error(`FFmpeg exited ${code}: ${tail}`));
      }
    });

    proc.on("error", (err) =>
      reject(new Error(`FFmpeg spawn error: ${err.message}`)),
    );
  });
}
