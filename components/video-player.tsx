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
  ctaUser?: { email: string; name: string | null };
  introStart?: number | null;
  introEnd?: number | null;
  creditsStart?: number | null;
};

const SAVE_INTERVAL_MS   = 10_000;
const BEACON_INTERVAL_MS = 30_000;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({
  src, poster, workId, initialSeconds, durationMinutes,
  cta, ctaUser,
  introStart, introEnd, creditsStart,
}: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const lastSaveRef   = useRef<number>(0);
  const lastBeaconRef = useRef<number>(0);
  const hasStarted    = useRef(false);
  const ctaShownRef   = useRef(false);

  const [ctaVisible,    setCtaVisible]    = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipCred,  setShowSkipCred]  = useState(false);
  const [speed,         setSpeed]         = useState(1);
  const [speedOpen,     setSpeedOpen]     = useState(false);

  useEffect(() => {
    if (!cta) return;
    try {
      if (localStorage.getItem(`aim_cta_signed_${cta.id}`)) ctaShownRef.current = true;
    } catch {}
  }, [cta]);

  function save(seconds: number) {
    void saveWatchProgress(workId, seconds, durationMinutes);
  }

  function skipIntro() {
    if (introEnd != null && videoRef.current) {
      videoRef.current.currentTime = introEnd;
      setShowSkipIntro(false);
    }
  }

  function skipCredits() {
    if (videoRef.current) videoRef.current.currentTime = videoRef.current.duration;
  }

  function applySpeed(s: number) {
    setSpeed(s);
    setSpeedOpen(false);
    if (videoRef.current) videoRef.current.playbackRate = s;
  }

  useEffect(() => {
    if (!speedOpen) return;
    const handler = () => setSpeedOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [speedOpen]);

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
        poster={poster}
        onPlay={() => {
          if (!hasStarted.current) {
            hasStarted.current = true;
            beacon("WATCH_START", { workId });
          }
          if (videoRef.current && videoRef.current.playbackRate !== speed) {
            videoRef.current.playbackRate = speed;
          }
        }}
        onLoadedMetadata={() => {
          if (initialSeconds > 0 && videoRef.current) {
            videoRef.current.currentTime = initialSeconds;
          }
          if (videoRef.current) videoRef.current.playbackRate = speed;
        }}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (!video || !video.duration) return;
          const t = video.currentTime;
          const dur = video.duration;
          const now = Date.now();

          if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
            lastSaveRef.current = now;
            save(Math.floor(t));
          }

          if (now - lastBeaconRef.current >= BEACON_INTERVAL_MS) {
            lastBeaconRef.current = now;
            beacon("WATCH_PROGRESS", { workId, metadata: { seconds: Math.floor(t), percent: Math.round((t / dur) * 100) } });
          }

          if (introStart != null && introEnd != null) {
            setShowSkipIntro(t >= introStart && t < introEnd);
          }

          if (creditsStart != null) {
            setShowSkipCred(t >= creditsStart && t < dur - 2);
          }

          if (cta && !ctaShownRef.current) {
            const remaining = dur - t;
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

      {showSkipIntro && (
        <button className="skip-btn" onClick={skipIntro} type="button">
          Skip Intro ›
        </button>
      )}

      {showSkipCred && !showSkipIntro && (
        <button className="skip-btn" onClick={skipCredits} type="button">
          Skip Credits ›
        </button>
      )}

      <div className="speed-wrap" onClick={(e) => e.stopPropagation()}>
        <button className="speed-btn" type="button" onClick={() => setSpeedOpen((o) => !o)}>
          {speed === 1 ? "Speed" : `${speed}×`}
        </button>
        {speedOpen && (
          <div className="speed-menu">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={`speed-option${s === speed ? " speed-option--active" : ""}`}
                onClick={() => applySpeed(s)}
              >
                {s === 1 ? "Normal" : `${s}×`}
              </button>
            ))}
          </div>
        )}
      </div>

      {cta && ctaVisible && (
        <NotifyMeCtaOverlay cta={cta} onDismiss={() => setCtaVisible(false)} ctaUser={ctaUser} />
      )}
    </div>
  );
}
