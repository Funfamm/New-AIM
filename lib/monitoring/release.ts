import "server-only";

// Release / environment tags attached to every captured error so the monitor can
// attribute a regression to the deploy that introduced it. Resolved once at module
// load — these are Vercel system env vars, stable for the life of the instance.

export const RELEASE: string | null =
  (process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)) ||
  (process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 24)) ||
  null;

export const ENVIRONMENT: string | null =
  process.env.VERCEL_ENV || process.env.NODE_ENV || null;
