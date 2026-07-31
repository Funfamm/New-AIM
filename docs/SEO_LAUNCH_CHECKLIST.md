# SEO Launch Checklist — AIM Studio

Status of the standard "things to do after your site is live" list, adapted for a **film
studio / streaming site** (not a local service business).

---

## ✅ Done in code

| Item | Where |
|---|---|
| sitemap.xml (auto, cached, all published works) | `app/sitemap.ts` |
| robots.txt (blocks `/admin`, `/dashboard`, `/api`) | `app/robots.ts` |
| Titles + descriptions, OG + Twitter cards | `app/layout.tsx` + per-page `metadata` |
| Per-film canonical URLs | `app/(public)/works/[slug]/page.tsx` |
| Site-wide canonical (kills `?utm_…` / www duplicate-URL dilution) | `app/layout.tsx` `alternates.canonical` |
| **Structured data (JSON-LD)** — Organization, WebSite + search box | `lib/seo/structured-data.ts`, `components/json-ld.tsx` |
| **Per-film schema** — `Movie` / `TVSeries` / `VideoObject` | `workSchema()` on the work detail page |
| Verification tag plumbing (env-driven, no code change needed) | `app/layout.tsx` `verification` |
| First-party analytics (visitors, dwell, bot filtering) | `/admin/analytics` — already better than GA for on-site behavior |

---

## 🔑 Needs your accounts (paste codes → done)

Set these in **Vercel → Settings → Environment Variables → Production**, then redeploy.
The tags render only when the var exists, so nothing breaks before then.

| Var | Where to get it |
|---|---|
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | [Search Console](https://search.google.com/search-console) → Add property → **HTML tag** method → copy the `content="…"` value |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION` | [Bing Webmaster Tools](https://www.bing.com/webmasters) → Add site → **Meta tag** → copy the `content="…"` value. (Bing also feeds ChatGPT search — worth doing.) |

After verifying, in **Search Console**: submit `https://impactaistudio.com/sitemap.xml`,
then use **URL Inspection → Request indexing** on the homepage, `/works`, and your top films.
Indexing takes days to weeks — that's normal, not a bug.

---

## ⚠️ Before adding GA4 / GTM / Clarity — two blockers

1. **CSP will silently block them.** `next.config.ts` has a strict Content-Security-Policy.
   Any tracker needs its domains added to `script-src` **and** `connect-src` (Clarity also
   needs `img-src`). Without that the script never loads and you'll see zero data with no
   error. Ask before adding — the CSP edit must ship with the tag.
2. **Privacy/consent.** Current analytics is first-party with **hashed IPs** — no consent
   banner required. GA4 and Clarity are third-party trackers, and **Clarity records session
   replays**. With EU visitors that means you need a cookie-consent banner and a privacy-
   policy update. This is a real decision, not a formality.

**Recommendation:** skip **GTM** (it's a container for managing many tags — pure overhead
for 1–2 scripts, plus its own CSP burden). If you want acquisition data, add **GA4 alone**.
Add **Clarity** only if you specifically want heatmaps/replays and accept the consent work.

---

## ❌ Doesn't apply to you

- **"Separate page for each location."** That's for businesses ranking in local map packs
  (plumbers, dentists, clinics). You're a studio with a global streaming audience — location
  pages would be thin, duplicative content that *hurts* rankings. Skip entirely.

---

## 📋 Content work (needs your input — highest long-term value)

- **Keyword research + clusters.** Needs your call on positioning: are you targeting
  *"AI-generated films"*, *"short film streaming"*, brand/commercial clients, or casting
  talent? Each implies a different cluster.
- **Service pages.** Genuinely applies — your work types already include `COMMERCIAL`,
  `BRANDING`, `CAMPAIGN`, `CASE_STUDY`, so you *do* offer client services, but there's no
  page selling them. A `/services` page (or one per service) is a real gap.
- **Unique content per page.** Every film needs a genuine, distinct synopsis — never
  duplicated or auto-generated boilerplate. Thin/duplicate descriptions are the #1 reason
  film pages fail to index.

---

## Verify your structured data

After deploy, paste a film URL into
[Google Rich Results Test](https://search.google.com/test/rich-results) — it should detect
`Movie` (or `TVSeries`/`VideoObject`) with title, image, duration, and genre.
