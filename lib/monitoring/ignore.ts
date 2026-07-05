// Well-known benign browser errors — noise, not bugs. They fire during normal use:
// the user navigates away and in-flight fetch/media requests abort, video players
// tear down mid-load, ResizeObserver churns. Filtered at BOTH the client reporter
// (skip the beacon) and the ingest route (defense-in-depth) so they never reach the
// monitor and never fire alerts.
//
// No server-only imports here — this module is shared by client and server code.

const IGNORED_CLIENT_ERROR_PATTERNS: RegExp[] = [
  /^Script error\.?$/i,                                    // cross-origin script, no detail
  /the operation was aborted/i,                            // AbortController (fetch/media) on navigation
  /\bAbortError\b/,
  /signal is aborted without reason/i,
  /the user aborted a request/i,
  /the play\(\) request was interrupted/i,                 // <video> play() cancelled by pause()/teardown
  /the fetching process for the media resource was aborted/i,
  /because the media was removed from the document/i,
  /ResizeObserver loop (limit exceeded|completed)/i,       // layout churn, harmless
  /Non-Error promise rejection captured/i,
];

/** True when a reported browser error message is known-benign navigation/teardown noise. */
export function isIgnorableClientError(message: string | null | undefined): boolean {
  if (!message || !message.trim()) return true;
  return IGNORED_CLIENT_ERROR_PATTERNS.some((re) => re.test(message));
}
