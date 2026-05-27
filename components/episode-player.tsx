"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveWatchProgress } from "@/lib/actions/progress";
import { beacon } from "@/lib/beacon";
import NotifyMeCtaOverlay, { type CtaData } from "./notify-cta-overlay";

type Props = {
  src: string;
  poster?: string;
  nextSlug?: string;
  workId: string;
  initialSeconds: number;
  durationMinutes?: number;
  cta?: CtaData | null;
  ctaUser?: { email: string; name: string | null };
};

const SAVE_INTERVAL_MS   = 10_000;
const BEACON_INTERVAL_MS = 30_000;

export default function EpisodePlayer({
  src, poster, nextSlug, workId, initialSeconds, durationMinutes, cta, ctaUser,
}: Props) {
  const router        = useRouter();
  const videoRef      = useRef<HTMLVideoElement>(null);
  const lastSaveRef   = useRef<number>(0);
  const lastBeaconRef = useRef<number>(0);
  const hasStarted    = useRef(false);
  const ctaShownRef   = useRef(false);

  const [ctaVisible, setCtaVisible] = useState(false);

  // Suppress CTA if already signed up in this browser
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

  function handleDismiss() {
    setCtaVisible(false);
    // ctaShownRef stays true — won't re-fire in the same session
  }

  return (
    <div className="watch-player-inner">
      <video
        ref={videoRef}
        src={src}
        className="watch-video"
        preload="metadata"
        controls
        playsInline
        controlsList="nodownload"
        disablePictureInPicture
        poster={poster}
        onPlay={() => {
          if (!hasStarted.current) {
            hasStarted.current = true;
            beacon("EPISODE_START", { workId });
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

          // CTA trigger
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
          beacon("EPISODE_COMPLETE", { workId });
          if (nextSlug) router.push(`/watch/${nextSlug}`);
        }}
      />
      {cta && ctaVisible && (
        <NotifyMeCtaOverlay cta={cta} onDismiss={handleDismiss} ctaUser={ctaUser} />
      )}
    </div>
  );
}
