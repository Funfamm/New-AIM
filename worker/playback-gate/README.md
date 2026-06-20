# AIM Playback Gate (Cloudflare Worker)

Gates full-film delivery from R2 behind short-lived signed tokens issued by the
Next.js watch page. Closes audit finding **F-01** (see
`docs/lite-playback-gate-plan.md` and `docs/lite-hls-streaming-audit.md` §12).

No DNS change is required: this runs on Cloudflare's free `*.workers.dev` address, in
the **same Cloudflare account that owns your R2 bucket**. A branded `stream.` subdomain
can be added later but is optional.

## How it works

1. The app signs a token = `HMAC(<exp>:<folder-prefix>)` with `PLAYBACK_SIGNING_KEY`
   and points the player at `https://<worker>.workers.dev/<key>?token=…`.
2. This Worker verifies the token, checks it hasn't expired, and confirms the requested
   object lives under the signed prefix. No/invalid/expired token → 302 to the platform.
3. For `.m3u8` playlists it appends the same token to every child URI, so segment
   requests stay authorised. Binary segments/MP4 are streamed with HTTP Range support.
4. Tokens expire after ~3h, so a copied link stops working and never works for a
   signed-out visitor.

## Deploy (one time)

Prereqs: Node installed, and you can log into the Cloudflare account that holds the bucket.

```bash
cd worker/playback-gate
npm install
npx wrangler login

# 1. Put your real bucket name in wrangler.toml (bucket_name), and set
#    WATCH_REDIRECT_BASE / ALLOWED_ORIGIN to your app origin.

# 2. Set the signing secret — MUST equal PLAYBACK_SIGNING_KEY in Vercel:
npx wrangler secret put PLAYBACK_SIGNING_KEY

# 3. Deploy:
npx wrangler deploy
```

`wrangler deploy` prints the Worker URL, e.g.
`https://aim-playback-gate.<your-subdomain>.workers.dev`.

## Turn the gate on (in the app)

Set these in Vercel (Production + Preview) and redeploy the app:

| Var | Value |
|-----|-------|
| `PLAYBACK_GATE_BASE_URL` | the Worker URL from `wrangler deploy` |
| `PLAYBACK_SIGNING_KEY` | the same secret you gave the Worker (generate with `openssl rand -base64 32`) |

Until both are set, the app serves films exactly as before (the gate is inert).

## Verify

1. Sign in, play a `requiresAuth` film — should play normally.
2. Copy the `…workers.dev/…/master.m3u8?token=…` URL into a fresh incognito window after
   ~3h (or with the token removed) → you are redirected to the platform; it does not play.
3. A `requiresAuth=false` film and all trailers/previews still serve from the public CDN.

## Roll back

Unset `PLAYBACK_GATE_BASE_URL` (or `PLAYBACK_SIGNING_KEY`) in Vercel and redeploy — the
app instantly reverts to public URLs. The Worker can be left deployed; it just stops
being referenced.
