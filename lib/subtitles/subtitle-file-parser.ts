export type SubtitleSegment = {
  start: number;
  end: number;
  text: string;
};

function timeToSeconds(ts: string): number {
  const parts = ts.trim().split(/[:,]/);
  if (parts.length === 4) {
    const [h, m, s, ms] = parts.map(Number);
    return h * 3600 + m * 60 + s + ms / 1000;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts.map(Number);
    return h * 3600 + m * 60 + s;
  }
  return 0;
}

export function parseSRT(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const blocks = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n\n+/)
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split(/\s*-->\s*/);
    const start = timeToSeconds(startStr);
    const end = timeToSeconds(endStr);
    const textLines = lines.slice(lines.indexOf(timeLine) + 1);
    const text = textLines.join(" ").trim().replace(/<[^>]+>/g, "");
    if (text) segments.push({ start, end, text });
  }
  return segments;
}

export function parseVTT(content: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let i = 0;
  while (i < lines.length && !lines[i].includes("-->")) i++;

  while (i < lines.length) {
    const timeLine = lines[i];
    if (!timeLine.includes("-->")) { i++; continue; }
    const [startStr, endStr] = timeLine.split(/\s*-->\s*/);
    const start = timeToSeconds(startStr.trim());
    const end = timeToSeconds(endStr.trim().split(/\s/)[0]);
    i++;
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].includes("-->")) {
      if (!/^\d+$/.test(lines[i].trim())) textLines.push(lines[i]);
      i++;
    }
    const text = textLines.join(" ").trim().replace(/<[^>]+>/g, "");
    if (text) segments.push({ start, end, text });
    while (i < lines.length && lines[i].trim() === "") i++;
  }
  return segments;
}

export function parseSubtitleFile(filename: string, content: string): SubtitleSegment[] {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "srt") return parseSRT(content);
  if (ext === "vtt") return parseVTT(content);
  throw new Error(`Unsupported subtitle format: ${ext}. Use .srt or .vtt`);
}
