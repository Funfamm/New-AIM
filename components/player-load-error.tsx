"use client";

import "./player-load-error.css";

type Props = {
  /** Re-attempt playback. Reloading the watch page resumes from saved progress. */
  onRetry: () => void;
};

// Shown when a video source fails to load (fatal HLS error or native media
// error) so the player surfaces a clear message instead of a frozen frame.
export default function PlayerLoadError({ onRetry }: Props) {
  return (
    <div className="player-load-error" role="alert">
      <p className="player-load-error-title">This video couldn&rsquo;t be loaded.</p>
      <p className="player-load-error-body">Check your connection and try again.</p>
      <button type="button" className="player-load-error-btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
