# Lite Premium Card Polish Audit

**Date:** 2026-06-04
**Project:** AIM Studio Lite (`aim-studio-lite`)
**Status:** Audit only — no code written

---

## 1. Current Lite Card Files

| File | Purpose |
|---|---|
| `components/film-card.tsx` | The card component used on homepage rails and works page |
| `components/film-card.css` | All card visual styles |
| `components/film-rail.tsx` | Rail wrapper that renders a row of FilmCards |
| `components/works-client.tsx` | Works page client component — renders FilmCards in rails and grid |
| `components/works-client.css` | Works page styles including `.rail-track` and `.wc-grid` |

No other card component exists. `FilmCard` is the single card used everywhere.

---

## 2. Current Lite Card Behavior

### What FilmCard renders today

- **2:3 portrait poster** — fills card, `object-cover`, correct aspect ratio
- **Rounded corners** — `var(--radius-md)` on both card and poster container
- **Bottom gradient** — `rgba(0,0,0,0.92)` at bottom to `transparent` at 55%
- **Genre label** — gold, uppercase, 0.625rem, over gradient
- **Title** — Cormorant Garamond, 1.0625rem, 2-line clamp, text-shadow
- **Type badge** — top-left, frosted glass, uppercase small label (Film / Short / Series etc.)
- **Status badge** — top-right, gold-tinted, for UPCOMING / IN_PRODUCTION
- **Lock badge** — top-right, for auth-gated content shown to guests
- **Play overlay** — gold circle with play icon, appears on hover
- **Hover lift** — `scale(1.05) translateY(-4px)`, gold box-shadow, 250ms cubic-bezier
- **Reduced motion** — respected via media query
- **Entire card is a link** — routes to `watchHref ?? /works/${slug}`

### What FilmCard is missing today

- **No visible action button with a text label** — the play circle on hover is a visual hint only; there is no persistent "Watch Now", "Watch Trailer", or "View Details" button
- **No CTA route resolution** — the card routes either to a pre-passed `watchHref` (only Continue Watching uses this) or the detail page `/works/${slug}` — never to the correct watch route for a card with a full video

### FilmRail type gap

`RailFilm` (the type passed through `film-rail.tsx`) only defines:
```typescript
{ id, slug, title, posterUrl, genre, requiresAuth, watchHref }
```
It omits `videoUrl`, `trailerUrl`, `type`, `status`, `heroMobileUrl`, `requiresLoginToViewTrailer`. These fields exist on the source data in `page.tsx` (`HOME_SELECT` includes them all) but are not threaded through to `FilmCard`.

### Works page select gap

`works/page.tsx` does not select `videoUrl` or `trailerUrl` in its Prisma query. Works page cards cannot determine correct CTA without these fields.

---

## 3. Old AIM Design Elements Worth Rebuilding

Reviewed: `src/components/mobile/MovieCard.tsx`, `src/components/mobile/CinematicPosterCard.tsx`, `src/components/desktop/HoverPreviewCard.tsx`

| Element | Old AIM implementation | Lite adaptation |
|---|---|---|
| **Info strip at bottom** | Separate `<div>` panel below image with title, genre pills, CTA button | Add a small info strip inside the poster frame, anchored to the bottom |
| **CTA button logic** | `primaryAction` resolved from `filmUrl` / `trailerUrl` inline | Use existing `lib/work-cta.ts` (already in Lite) |
| **CTA button style** | Colored border + background based on availability (green=watch, gold=trailer, grey=details) | Adapt to Lite design tokens: gold/white/muted |
| **Genre pill inside card** | Small gold uppercase pill with border | Lite already has `.fc-genre` label — can upgrade to pill style |
| **Gold accent on CTA** | `rgba(212,168,83,0.12)` bg, gold text | Match Lite's `--color-brand-accent` |
| **Full-bleed poster with gradient** | 60% bottom gradient `rgba(0,0,0,0.85) → transparent` | Lite has this; deepen slightly |

---

## 4. What to Skip from Old AIM Card System

| Feature | Reason to skip |
|---|---|
| `HoverPreviewCard` — portal-based video preview on hover | Complex, uses `createPortal`, video autoplay, inline styles, API calls in render; not needed for a card polish |
| `useState` image fade-in (`imgLoaded`) | Adds JS hydration weight; Next.js `Image` handles this |
| i18n localization wrappers (`getLocalizedProject`, `useTranslations`) | Not relevant to Lite |
| Watchlist API calls inside the card | Different system; SaveButton in Lite handles this separately |
| Analytics tracking `fetch` inside `onClick` | Out of scope |
| `press-feedback` class using inline styles everywhere | Not Lite's pattern; use CSS classes |
| Status badge with emoji labels (`✓ Released`, `🎬 In Production`) | Use Lite's existing clean frosted-glass badge system |
| `onHover` / `onHoverEnd` callback props for the hover preview system | Not needed; skip the entire hover preview card system |

---

## 5. Exact Files to Touch

| File | Change |
|---|---|
| `components/film-card.tsx` | Add `videoUrl?`, `trailerUrl?`, `requiresLoginToViewTrailer?` props; add CTA label + button in card info area |
| `components/film-card.css` | Add `.fc-cta` button styles inside the card; adjust `.fc-info` padding to accommodate button |
| `components/film-rail.tsx` | Expand `RailFilm` type to include `videoUrl`, `trailerUrl`, `type`, `heroMobileUrl`, `status`, `requiresLoginToViewTrailer` |
| `app/(public)/works/page.tsx` | Add `videoUrl: true`, `trailerUrl: true`, `requiresLoginToViewTrailer: true` to the Prisma select |

**Not touched:** homepage `page.tsx` (data already includes these fields), `work-cta.ts` (no change needed), any admin file, any schema, any CSS other than `film-card.css`.

---

## 6. Action Button Logic — Does It Already Exist?

**Yes — `lib/work-cta.ts` exists in Lite and is correct.**

It returns `primaryLabel`, `primaryHref`, `secondaryLabel`, `secondaryHref` based on:
- `videoUrl` → "Watch Full Film" / "Watch Short" / "Watch Series" / "Watch Commercial" etc.
- `trailerUrl` only → "Watch Trailer"
- Neither → `primaryLabel = ""` → show "View Details"
- Auth gating → "Sign In to Watch"

The card only needs to use the `primaryLabel` and `primaryHref`. Secondary CTA (trailer) is optional and can be skipped on cards to keep them compact.

**Note on label:** `work-cta.ts` returns type-specific labels ("Watch Short", "Watch Full Film"). The user's requirement says "Watch Now" for full video — this can be handled by either:
- Mapping at the card level: if `primaryHref` goes to a watch route, label becomes "Watch Now"
- Or using the type-specific label from `work-cta.ts` as-is (more informative)

Recommendation: use `work-cta.ts` as-is — "Watch Short", "Watch Series" etc. are more informative than a generic "Watch Now". The Lite hero already uses these labels.

---

## 7. CTA Helper Needed?

No new helper needed. `lib/work-cta.ts` already covers the full logic. `FilmCard` will call it directly using the new props.

---

## 8. Mobile Performance Risk

| Change | Risk | Mitigation |
|---|---|---|
| CTA button added to card | None — pure CSS, no extra JS | Button is rendered server-side via RSC props |
| Extra props through FilmRail | None — TypeScript types only | No runtime overhead |
| Works page query adds `videoUrl`, `trailerUrl` | Very Low — 2 extra nullable columns in existing query | Negligible DB impact; both columns indexed by usage |
| New `.fc-cta` CSS | None | ~20 lines of CSS |

No extra images, videos, API calls, or animations added. Mobile performance is unchanged.

---

## 9. Recommended Implementation Plan

### Step 1 — Expand FilmRail type and card props (~15 min)
- Add `videoUrl?`, `trailerUrl?`, `type?`, `status?`, `heroMobileUrl?`, `requiresLoginToViewTrailer?` to `RailFilm` in `film-rail.tsx`
- Add the same to `FilmCardProps` in `film-card.tsx`

### Step 2 — Add CTA button to FilmCard (~20 min)
- In `film-card.tsx`: call `getWorkCtaState` when `videoUrl`/`trailerUrl`/`type` are available
- Replace the outer card `<Link>` destination: use `primaryHref` when it resolves, else `/works/${slug}`
- Add a small `.fc-cta` button label inside `.fc-info` below the title
- Button shows: `primaryLabel` or "View Details" as fallback
- Keep entire card as a link (the button is a visual label, not a nested interactive element)

### Step 3 — Add CSS for CTA button (~15 min)
In `film-card.css`:
- `.fc-cta` — small pill or capsule button at bottom of info area
- Gold text on subtle dark background, 0.6rem–0.65rem, uppercase
- No heavy border — keep it lightweight
- Reduce motion: no animation

### Step 4 — Works page query update (~5 min)
- Add `videoUrl: true, trailerUrl: true, requiresLoginToViewTrailer: true` to `works/page.tsx` select

### Step 5 — TypeScript check + smoke test

**Total: ~55 minutes. Very low risk.**

---

## 10. Schema / Database Change Needed?

**No.** `videoUrl`, `trailerUrl`, `requiresLoginToViewTrailer` already exist on the `Work` model. This is purely a query select + component prop change.

---

## Summary

| # | Item | Answer |
|---|---|---|
| 1 | Current Lite card component | `components/film-card.tsx` + `film-card.css` |
| 2 | Current card behavior | Poster-only card link; no visible action button label |
| 3 | Old AIM elements to use | Info strip + CTA button concept; gold-accented CTA; genre pill upgrade |
| 4 | Old AIM elements to skip | Hover preview card, inline styles, i18n, analytics, watchlist API in card |
| 5 | Files to touch | `film-card.tsx`, `film-card.css`, `film-rail.tsx`, `works/page.tsx` |
| 6 | Action button logic exists? | Yes — `lib/work-cta.ts` is complete and correct |
| 7 | CTA helper needed? | No — use existing `work-cta.ts` |
| 8 | Mobile performance risk | None — pure additive CSS + props |
| 9 | Schema change needed? | No |

---

*Audit completed 2026-06-04. No code was written. Awaiting approval to implement.*
