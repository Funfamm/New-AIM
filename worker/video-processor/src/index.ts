import { checkFfmpeg } from "./ffmpeg";
import { processOne } from "./worker";

async function main(): Promise<void> {
  await checkFfmpeg();
  console.log("[worker] FFmpeg OK");

  const result = await processOne();

  if (!result.claimed) {
    process.exit(0);
  }
  if (!result.succeeded) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[worker] Fatal:", (err as Error).message);
  process.exit(1);
});
