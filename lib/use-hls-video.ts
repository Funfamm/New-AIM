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
 * Recoverable hls.js errors (network/media) are retried automatically.
 * An unrecoverable fatal error invokes `onError` so the player can surface a
 * visible message instead of a frozen black frame. Native (Safari/MP4)
 * playback failures are reported separately via the <video> onError handler.
 *
 * The consuming component must NOT set src={...} on the <video> element —
 * this hook owns src assignment.
 */
export function useHlsVideo(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  src: string,
  onError?: () => void
): void {
  const hlsRef = useRef<HlsType | null>(null);
  // Keep the latest onError without re-running the effect when it changes.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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
      // webpackPrefetch hints the browser to fetch the hls.js chunk during idle
      // time so first-play latency is reduced on supported browsers.
      const { default: Hls } = await import(/* webpackPrefetch: true */ "hls.js");
      if (cancelled) return;

      if (!Hls.isSupported()) {
        // Last-resort native attempt (may fail, but avoids blank screen)
        video.src = src;
        return;
      }

      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Transient network issue — ask hls.js to resume loading.
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            // Recoverable decode/buffer stall.
            hls.recoverMediaError();
            break;
          default:
            // Unrecoverable — tear down and surface the error.
            hls.destroy();
            hlsRef.current = null;
            onErrorRef.current?.();
            break;
        }
      });

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
