"use client";

import { useRef } from "react";
import { saveWatchProgress } from "@/lib/actions/progress";
import { beacon } from "@/lib/beacon";

type Props = {
  src: string;
  poster?: string;
  workId: string;
  initialSeconds: number;
  durationMinutes?: number;
};

const SAVE_INTERVAL_MS = 10_000;

export default function VideoPlayer({
  src, poster, workId, initialSeconds, durationMinutes,
}: Props) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const lastSaveRef  = useRef<number>(0);
  const hasStarted   = useRef(false); // fire WATCH_START only on first play

  function save(seconds: number) {
    void saveWatchProgress(workId, seconds, durationMinutes);
  }

  return (
    <video
      ref={videoRef}
      src={src}
      className="watch-video"
      controls
      playsInline
      poster={poster}
      onPlay={() => {
        if (!hasStarted.current) {
          hasStarted.current = true;
          beacon("WATCH_START", { workId });
        }
      }}
      onLoadedMetadata={() => {
        if (initialSeconds > 0 && videoRef.current) {
          videoRef.current.currentTime = initialSeconds;
        }
      }}
      onTimeUpdate={() => {
        const video = videoRef.current;
        if (!video) return;
        const now = Date.now();
        if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
          lastSaveRef.current = now;
          save(Math.floor(video.currentTime));
        }
      }}
      onPause={() => {
        const video = videoRef.current;
        if (video) save(Math.floor(video.currentTime));
      }}
      onEnded={() => {
        const video = videoRef.current;
        if (video) save(Math.floor(video.duration));
        beacon("WATCH_COMPLETE", { workId });
      }}
    />
  );
}
