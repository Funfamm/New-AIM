import http from "http";
import { checkFfmpeg } from "./ffmpeg";
import { processOne } from "./worker";
import { processSubtitleJob } from "./subtitle-worker";
import { WORKER_PORT } from "./config";

let busy = false;

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        status: "live",
        busy,
        pid: process.pid,
        uptime: Math.round(process.uptime()),
      }),
    );

  } else if (req.method === "POST" && req.url === "/run") {
    if (busy) {
      res.writeHead(200);
      res.end(JSON.stringify({ status: "busy", message: "Already processing a job" }));
      return;
    }
    // Acknowledge immediately — processing happens in background
    res.writeHead(202);
    res.end(JSON.stringify({ status: "triggered" }));

    setImmediate(async () => {
      busy = true;
      try {
        const result = await processOne();
        if (!result.claimed) await processSubtitleJob();
      } catch (err) {
        console.error("[daemon] Unhandled error:", (err as Error).message);
      } finally {
        busy = false;
      }
    });

  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(WORKER_PORT, "127.0.0.1", () => {
  console.log(`[daemon] Listening on http://127.0.0.1:${WORKER_PORT}`);
  console.log(`[daemon] Polling for jobs every 30s`);
});

async function poll(): Promise<void> {
  for (;;) {
    await new Promise<void>((r) => setTimeout(r, 30_000));
    if (busy) continue;
    busy = true;
    try {
      const result = await processOne();
      // If no video job was found, check for subtitle translation jobs
      if (!result.claimed) await processSubtitleJob();
    } catch (err) {
      console.error("[daemon] Poll error:", (err as Error).message);
    } finally {
      busy = false;
    }
  }
}

checkFfmpeg()
  .then(() => {
    console.log("[daemon] FFmpeg OK");
    poll();
  })
  .catch((err) => {
    console.error("[daemon] FFmpeg check failed:", err.message);
    process.exit(1);
  });
