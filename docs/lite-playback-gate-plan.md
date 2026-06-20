# AIM Studio Lite — Playback Gate Implementation Plan

**Date:** 2026-06-20
**Goal (F-01):** Stop non-members watching full films. Make the film files unplayable
unless the request carries a valid, short-lived token that the watch page only issues
*after* the existing access check passes.
**Non-goal:** DRM / stopping screen-recording. Not worth it at this stage (see audit §12).

---

## Design — token-in-URL + Cloudflare Worker

Chosen over a signed cookie because the Next.js watch page is a Server Component, and
Server Components cannot set cookies (only Route Handlers / Server Actions / middleware
can). A token in the URL is built as a plain string in the page — no cookie plumbing.

```
Member loads /watch/the-film  ──►  existing requiresAuth check passes
        │
        ▼
Watch page builds a signed token  =  HMAC( workId + expiry , PLAYBACK_SIGNING_KEY )
        │
        ▼
Player src = https://stream.impactaistudio.com/works/the-film/hls/master.m3u8?token=…
        │
        ▼
Cloudflare Worker (on stream.impactaistudio.com, R2 binding):
   • no/!valid/expired token ► 302 redirect to /watch/the-film  (or 403)
   • valid token ► serve the object from R2
   • if the object is an .m3u8 ► rewrite each child URL to carry a fresh token
        │
        ▼
Browser fetches each .ts/.mp4 segment WITH a token ► Worker re-validates ► serves
```

- **Token TTL:** ~3 hours. A copied link dies after that and never works for a signed-out
  visitor. Long enough to watch a film; short enough to make link-sharing pointless.
- **Trailers/previews stay public** (recommended) — they are the shareable hook that
  pulls people to sign up. Only `videoUrl` (full film / episodes) goes through the gate.

---

## What I build in this repo (safe, inert until configured)

| File | Purpose |
|------|---------|
| `lib/playback-token.ts` | `signPlaybackToken(workId)` / `verifyPlaybackToken()` — HMAC, no deps |
| `lib/playback-url.ts` | `resolvePlaybackUrl(rawUrl, workId)` — returns the gated tokenized URL **only when the gate env vars are set**; otherwise returns the raw URL unchanged (zero behaviour change) |
| `app/(public)/watch/[slug]/page.tsx` | pass the full-film `src` through `resolvePlaybackUrl` |
| `worker/playback-gate/` | the Cloudflare Worker: `src/index.ts`, `wrangler.toml`, `README.md` |

**Feature flag:** everything is gated behind two env vars. If they are unset, the app
serves exactly as it does today — so this can merge with no risk and be switched on later.

- `PLAYBACK_GATE_BASE_URL` — e.g. `https://stream.impactaistudio.com`
- `PLAYBACK_SIGNING_KEY` — random 32+ byte secret, shared between Vercel app and the Worker

---

## What you deploy (I provide code + exact steps)

1. **Subdomain → Worker.** Route `stream.impactaistudio.com` to the Worker. Requires the
   domain's DNS to be on Cloudflare.
2. **R2 binding.** Bind the existing bucket to the Worker in `wrangler.toml`.
3. **Lock down public film access.** Keep trailers public; ensure full-film objects are
   only reachable through the Worker (don't hand out their `r2.dev` URL).
4. **Env vars.** Set `PLAYBACK_GATE_BASE_URL` + `PLAYBACK_SIGNING_KEY` on Vercel, and the
   same `PLAYBACK_SIGNING_KEY` on the Worker (`wrangler secret put`).

---

## Data / migration

**No DB migration required.** The stored `videoUrl` already encodes the R2 key (it is
`R2_PUBLIC_BASE_URL + "/" + key`). `resolvePlaybackUrl` derives the key by stripping the
public base and rebuilds it against `PLAYBACK_GATE_BASE_URL`. Existing rows keep working;
nothing in the database changes.

---

## Rollout

1. Merge the inert code (no behaviour change).
2. Deploy the Worker to `stream.impactaistudio.com`; set the shared secret.
3. Set the two Vercel env vars → the gate activates for full films only.
4. Test: signed-in member plays normally; copied `stream.…/master.m3u8` URL in a fresh
   browser → redirected to the watch page; token expires after ~3h.
5. Roll back instantly by unsetting the Vercel env vars (reverts to public URLs).

---

## Open infra questions (needed to finalise the Worker)

1. Is `impactaistudio.com` DNS managed in **Cloudflare**? (Required to route a subdomain
   to a Worker. If DNS is on Vercel/registrar, the subdomain must be delegated to Cloudflare.)
2. Preferred streaming subdomain? (default suggestion: `stream.impactaistudio.com`)
3. Confirm: gate **full films/episodes only**, leave trailers + previews public? (recommended)
