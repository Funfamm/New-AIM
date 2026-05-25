"use client";

import { useRef, useState, useEffect } from "react";
import { saveWatchProgress } from "@/lib/actions/progress";
import { beacon } from "@/lib/beacon";
import NotifyMeCtaOverlay, { type CtaData } from "./notify-cta-overlay";

type Props = {
  src: string;
  poster?: string;
  workId: string;
  initialSeconds: number;
  durationMinutes?: number;
  cta?: CtaData | null;
};

const SAVE_INTERVAL_MS   = 10_000;
const BEACON_INTERVAL_MS = 30_000;

export default function VideoPlayer({
  src, poster, workId, initialSeconds, durationMinutes, cta,
}: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const lastSaveRef   = useRef<number>(0);
  const lastBeaconRef = useRef<number>(0);
  const hasStarted    = useRef(false);
  // ctaShownRef gates the trigger — prevents re-checking after first fire
  const ctaShownRef   = useRef(false);

  const [ctaVisible, setCtaVisible] = useState(false);

  // If the user already signed up in this browser (localStorage), suppress CTA permanently
  useEffect(() => {
    if (!cta) return;
    try {
      if (localStorage.getItem(`aim_cta_signed_${cta.id}`)) {
        ctaShownRef.current = true;
      }
    } catch {}
  }, [cta]);

  function save(seconds: number) {
    void saveWatchProgress(workId, seconds, durationMinutes);
  }

  // Dismiss hides the overlay for this playback session but doesn't set localStorage
  // (so it can re-appear on a future visit if the user never signed up)
  function handleDismiss() {
    setCtaVisible(false);
    // Keep ctaShownRef = true so it won't re-trigger within the same video session
  }

  return (
    <div className="watch-player-inner">
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

          // Progress save
          if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
            lastSaveRef.current = now;
            save(Math.floor(video.currentTime));
          }

          // Analytics beacon
          if (
            now - lastBeaconRef.current >= BEACON_INTERVAL_MS &&
            video.duration > 0 && !isNaN(video.duration)
          ) {
            lastBeaconRef.current = now;
            beacon("WATCH_PROGRESS", {
              workId,
              metadata: {
                seconds: Math.floor(video.currentTime),
                percent: Math.round((video.currentTime / video.duration) * 100),
              },
            });
          }

          // CTA trigger — fires once when remaining time ≤ triggerSecondsFromEnd
          if (cta && !ctaShownRef.current && video.duration > 0 && !isNaN(video.duration)) {
            const remaining = video.duration - video.currentTime;
            if (remaining > 0 && remaining <= cta.triggerSecondsFromEnd) {
              ctaShownRef.current = true;
              setCtaVisible(true);
              beacon("CTA_IMPRESSION", { workId, metadata: { ctaId: cta.id } });
            }
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
      {cta && ctaVisible && (
        <NotifyMeCtaOverlay cta={cta} onDismiss={handleDismiss} />
      )}
    </div>
  );
}
