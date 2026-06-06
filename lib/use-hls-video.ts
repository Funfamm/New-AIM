"use client";

import { useEffect, useRef } from "react";
import type HlsType from "hls.js";

/**
 * Attaches an HLS or plain video source to a <video> element.
 *
 * - Non-.m3u8 URLs: sets video.src directly (native <video>).
 * - .m3u8 on Safari/iOS: sets video.src (native HLS support).
 * - .m3u8 on Chrome/Edge/Firefox: dynamically imports hls.js, creates an
 *   HLS instance, and destroys it on cleanup.
 *
 * The consuming component must NOT set src={...} on the <video> element —
 * this hook owns src assignment.
 */
export function useHlsVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  src: string
): void {
  const hlsRef = useRef<HlsType | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Non-HLS source — native <video> handles it
    if (!src.endsWith(".m3u8")) {
      video.src = src;
      return;
    }

    // Safari / iOS: native HLS support
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    // Chrome / Edge / Firefox: need hls.js
    let cancelled = false;

    void (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;

      if (!Hls.isSupported()) {
        // Last-resort native attempt (may fail, but avoids blank screen)
        video.src = src;
        return;
      }

      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    })();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  // videoRef is a stable ref object — omitting it from deps is intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
}
