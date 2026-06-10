"use client";

/**
 * HeroVideoBg — desktop-only muted preview video for the hero rotator.
 *
 * Guards:
 *  - viewport < 1024 px     → renders nothing
 *  - prefers-reduced-motion → renders nothing
 *  - navigator.connection.saveData → renders nothing
 *  - effectiveType slow-2g / 2g → renders nothing
 *
 * Behaviour:
 *  - preload="none": no bytes fetched until slide becomes active
 *  - fades in via opacity once the browser can play
 *  - stops after 12 s and returns to the static poster / Ken Burns image
 *  - inactive slides: immediately paused + source cleared (stops buffering)
 *  - HLS (.m3u8): uses existing hls.js pattern (same as AimPlayer)
 *  - MP4: native <video>
 *  - any error: silently falls back to poster — no broken state
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
  if (conn?.saveData) return false;
  if (conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") return false;
  return true;
}

export default function HeroVideoBg({ src, isActive }: Props) {
  // Determined once on mount — avoids SSR mismatch
  const [canUse, setCanUse] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef   = useRef<import("hls.js").default | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client-only capability check
  useEffect(() => {
    setCanUse(isDesktopCapable());
  }, []);

  // Manage video lifecycle when active state or capability changes
  useEffect(() => {
    if (!canUse || !src) return;
    const video = videoRef.current;
    if (!video) return;

    if (!isActive) {
      // Inactive: stop everything immediately
      video.pause();
      setVideoVisible(false);
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (hlsRef.current)   { hlsRef.current.destroy(); hlsRef.current = null; }
      video.removeAttribute("src");
      video.load(); // reset buffer
      return;
    }

    // Active: start loading + playing
    let cancelled = false;

    function startPlayback() {
      if (cancelled || !videoRef.current) return;
      const v = videoRef.current;
      v.currentTime = 0;
      v.play().catch(() => {
        // Autoplay blocked — stay on poster silently
        setVideoVisible(false);
      });
      timerRef.current = setTimeout(() => {
        videoRef.current?.pause();
        setVideoVisible(false);
      }, PREVIEW_MS);
    }

    if (src.endsWith(".m3u8")) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari / iOS native HLS
        video.src = src;
        startPlayback();
      } else {
        // Chrome / Edge / Firefox — hls.js
        void (async () => {
          const { default: Hls } = await import("hls.js");
          if (cancelled || !videoRef.current) return;
          if (!Hls.isSupported()) {
            videoRef.current.src = src;
            startPlayback();
            return;
          }
          const hls = new Hls({ enableWorker: true, autoStartLoad: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
        })();
      }
    } else {
      // Direct MP4 / WebM
      video.src = src;
      startPlayback();
    }

    return () => {
      cancelled = true;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [isActive, canUse, src]);

  // Not capable — render nothing (keeps poster / Ken Burns)
  if (!canUse) return null;

  return (
    <video
      ref={videoRef}
      className={`hr-video${videoVisible ? " hr-video--visible" : ""}`}
      muted
      playsInline
      preload="none"
      aria-hidden="true"
      onCanPlay={() => { if (isActive) setVideoVisible(true); }}
      onError={() => setVideoVisible(false)}
    />
  );
}
