"use client";

/**
 * HeroVideoBg — desktop-only muted preview video for the hero rotator.
 *
 * Guards:
 *  - viewport < 1024 px              → renders nothing
 *  - prefers-reduced-motion          → renders nothing
 *  - navigator.connection.saveData   → renders nothing (missing API = allowed)
 *  - effectiveType slow-2g / 2g      → renders nothing (missing API = allowed)
 *
 * Behaviour:
 *  - preload="none": no bytes fetched until slide becomes active
 *  - fades in via opacity once canplay fires
 *  - 12 s timer starts AFTER canplay (full 12 s of visible video, not counting buffer time)
 *  - stops after 12 s and returns to static poster / Ken Burns image
 *  - inactive slides: immediately paused + source cleared (stops all buffering)
 *  - HLS (.m3u8): hls.js on Chrome/Firefox/Edge; native on Safari
 *  - MP4/WebM: native <video>
 *  - any error or blocked autoplay: silently falls back to poster
 */

import { useEffect, useRef, useState } from "react";

type Props = {
  /** previewClipUrl from the Work model — mp4 or .m3u8 */
  src: string;
  /** Whether this slide is the active/visible slide */
  isActive: boolean;
};

const PREVIEW_MS = 12_000;

type NavConn = {
  saveData?: boolean;
  effectiveType?: string;
};

function isDesktopCapable(): boolean {
  if (typeof window === "undefined") return false;
  if (window.innerWidth < 1024) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: NavConn }).connection;
  // If Network Information API is absent, assume capable — don't block on missing API
  if (conn?.saveData === true) return false;
  if (conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") return false;
  return true;
}

export default function HeroVideoBg({ src, isActive }: Props) {
  // Determined once on client mount — avoids SSR/hydration mismatch
  const [canUse, setCanUse] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef   = useRef<import("hls.js").default | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client-only capability check (runs once after hydration)
  useEffect(() => {
    setCanUse(isDesktopCapable());
  }, []);

  // Manage video lifecycle when active state or capability changes
  useEffect(() => {
    if (!canUse || !src) return;
    const video = videoRef.current;
    if (!video) return;

    if (!isActive) {
      // Inactive: stop everything and free the buffer immediately
      video.pause();
      setVideoVisible(false);
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (hlsRef.current)   { hlsRef.current.destroy(); hlsRef.current = null; }
      video.removeAttribute("src");
      video.load(); // resets internal decoder
      return;
    }

    // Active: start loading then playing
    let cancelled = false;

    function startLoad() {
      if (cancelled || !videoRef.current) return;
      const v = videoRef.current;
      // Imperative muted assignment — JSX muted attr is not always reflected in the
      // DOM property before play() is called, which breaks Chrome's autoplay policy.
      v.muted = true;
      v.currentTime = 0;
      v.play().catch(() => {
        // Autoplay blocked by browser policy — stay on poster silently
        setVideoVisible(false);
      });
      // NOTE: 12-second display timer is started in onCanPlay, not here.
      // This ensures the full 12 s is visible video, not buffering time.
    }

    if (src.endsWith(".m3u8")) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari / iOS — native HLS
        video.src = src;
        startLoad();
      } else {
        // Chrome / Edge / Firefox — hls.js
        void (async () => {
          const { default: Hls } = await import("hls.js");
          if (cancelled || !videoRef.current) return;
          if (!Hls.isSupported()) {
            // Fallback: try native (rare)
            videoRef.current.src = src;
            startLoad();
            return;
          }
          const hls = new Hls({ enableWorker: true, autoStartLoad: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, startLoad);
        })();
      }
    } else {
      // Direct MP4 / WebM
      video.src = src;
      startLoad();
    }

    return () => {
      cancelled = true;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [isActive, canUse, src]);

  // Not capable — render nothing (poster / Ken Burns image stays)
  if (!canUse) return null;

  return (
    <video
      ref={videoRef}
      className={`hr-video${videoVisible ? " hr-video--visible" : ""}`}
      muted
      playsInline
      preload="none"
      aria-hidden="true"
      onCanPlay={() => {
        if (!isActive) return;
        setVideoVisible(true);
        // Start 12 s countdown only once the browser confirms it can play.
        // Replaces any stale timer from a previous activation.
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          videoRef.current?.pause();
          setVideoVisible(false);
        }, PREVIEW_MS);
      }}
      onError={() => setVideoVisible(false)}
    />
  );
}
