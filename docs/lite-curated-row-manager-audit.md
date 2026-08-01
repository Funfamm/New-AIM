# AIM Studio Lite — Curated Row Manager Audit

**Date:** 2026-06-05  
**Status:** Audit Complete — Ready for Implementation Approval

---

## Executive Summary

Enable admins to create custom rows/collections of projects with flexible placement (Homepage, Works page, or both) while preserving current system as fallback. This audit outlines the current row structure, proposed schema, admin UI, and rendering strategy based on the existing FilmRail + featured/showOnHome pattern.

---

## 1. Current Homepage Row System

**Location:** `app/(public)/page.tsx`

**Current rows:**
1. Hero section (HeroDesktopSection + MobileFeaturedHero)
   - Uses 5 featured works (featured: true, showOnHome: true)
   - Carousel/rotator pattern
   - Dynamic CTA buttons based on work type

2. Continue Watching (FilmRail)
   - User-specific (from WatchProgress)
   - Only shown if userId exists and progress exists
   - Ordered by updatedAt (recent)

3. Featured Works (FilmRail)
   - Query: `featured: true, showOnHome: true`
   - Takes 6 items
   - Labeled "Featured Works" / "— Now Streaming"
   - `priority` flag set (affects rendering/preload)

4. New Releases (FilmRail)
   - Query: `showOnHome: true` (no featured filter)
   - Takes 8 items
   - Ordered by createdAt (descending = newest first)
   - Labeled "New Releases" / "— Latest Work"

5. Empty state
   - Shows if no featured + no new releases

6. Brand strip
   - Static "Stories That Matter" copy

7. Studio Identity
   - Static about section

**Control mechanism:** Boolean flags on Work model
- `featured` → appears in Featured Works row
- `showOnHome` → appears on homepage (required for both Featured and New Releases)

**Rendering:** Rows are hardcoded in JSX. Order is fixed. Cannot be reordered or hidden by admin.

---

## 2. Current Works Page Row/Grid System

**Location:** `app/(public)/works/page.tsx` + `components/works-client.tsx`

**Current structure:**
- Server fetches all published/upcoming/in-production works
- Client-side filtering via tabs
- 9 collections/tabs:
  1. ALL — all works
  2. UPCOMING — status-filtered (UPCOMING, IN_PRODUCTION)
  3. FILMS — type FULL_FILM
  4. SHORTS — type SHORT_FILM
  5. SERIES — type SERIES
  6. COMMERCIAL — type COMMERCIAL
  7. BRANDING — type BRANDING
  8. CAMPAIGNS — type CAMPAIGN
  9. TRAILERS — type TRAILER
  10. CASE_STUDY — type CASE_STUDY

**Control mechanism:** Hardcoded TAB_TYPES array mapping. No admin control.

**Rendering:** Works are displayed as grid cards (FilmCard) beneath the selected tab. No row/rail structure currently.

---

## 3. FilmRail Component

**Location:** `components/film-rail.tsx`

**Purpose:** Horizontal scrolling container for films with left/right navigation arrows.

**Props:**
```typescript
type FilmRailProps = {
  title: string;
  label?: string;        // eyebrow text (e.g. "— Latest Work")
  href?: string;         // "View All" link
  films: RailFilm[];    // array of works
  priority?: boolean;    // preload optimization
  isLoggedIn?: boolean;
};
```

**Features:**
- Horizontal scroll with snap
- Scroll detection (enable/disable arrow buttons)
- Smooth scroll behavior
- Returns null if films.length === 0 (prevents empty rows)

**Used for:**
- Continue Watching
- Featured Works
- New Releases

---

## 4. FilmCard Component

**Location:** `components/film-card.tsx`

**Purpose:** Individual work card displayed inside rails/grids.

**Features:**
- Poster image + overlay
- Genre badge
- CTA button (derived from work-cta.ts)
- "Save" button (heart icon)
- Type badge
- Responsive image sizing
- Mobile optimized

**Not being changed:** Custom row system will reuse existing FilmCard without modification.

---

## 5. Current Work Model Fields

**Location:** `prisma/schema.prisma`

**Relevant fields:**
```prisma
featured        Boolean  @default(false)    // in Featured Works rail
showOnHome      Boolean  @default(false)    // appears on homepage at all
order           Int      @default(0)        // sort order for featured
```

**No relationship to rows currently.** Works are not linked to any collection/row model.

---

## 6. Existing Collection/Row Models

**Finding:** None. No ContentRow, MovieRoll, EditorialRow, or similar model exists in Lite or Ultra.

This is a new feature area.

---

## 7. Old AIM Studio Reference

**Checked:** Ultra AIM Studio codebase.

**Finding:** No curated row/collection system found. Ultra uses:
- Filter tabs (like Lite Works page)
- Featured flag (like Lite)
- Type-based categorization (like Lite)

No MovieRoll or previous collection system to reference. This is a greenfield feature for the entire AIM project family.

---

## 8. Admin Current Structure

**Location:** `components/admin-sidebar.tsx`

**Current admin pages:**
- Overview
- Works
- Users
- Analytics
- Outreach
- Notify Me
- Subscribers
- Comments
- Engagement
- Security
- Email
- Settings
- Data
- Audit Log

**No "Rows" or "Collections" page yet.**

---

## 9. Recommended Schema Design

### Models to add:

**RowPlacement enum:**
```prisma
enum RowPlacement {
  HOME    // Homepage only
  WORKS   // Works page only
  BOTH    // Both pages
}
```

**ContentRow model:**
```prisma
model ContentRow {
  id          String       @id @default(cuid())
  title       String       // "Featured Works", "New Releases", etc.
  slug        String       @unique
  description String?      // optional subtitle
  placement   RowPlacement @default(HOME)
  active      Boolean      @default(true)    // deactivate without deleting
  sortOrder   Int          @default(0)       // lower = higher on page
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  items       ContentRowItem[]

  // Index for common queries: fetch active rows by placement, ordered
  @@index([placement, active, sortOrder])
}
```

**ContentRowItem model (join table):**
```prisma
model ContentRowItem {
  id        String   @id @default(cuid())
  rowId     String
  workId    String
  sortOrder Int      @default(0)    // lower = first in row
  createdAt DateTime @default(now())

  row       ContentRow @relation(fields: [rowId], references: [id], onDelete: Cascade)
  work      Work       @relation(fields: [workId], references: [id], onDelete: Cascade)

  // Prevent duplicate work in same row
  @@unique([rowId, workId])
  
  // Indexes for common queries
  @@index([rowId, sortOrder])
  @@index([workId])
}
```

**Update Work model:**
```prisma
model Work {
  // ... existing fields ...
  
  // Add many-to-many relation to curated rows
  contentRowItems ContentRowItem[]
}
```

### Why this design:

- **Many-to-many:** Work can appear in multiple rows (e.g., "Papaoutai" in Featured, Shorts, and New Releases)
- **Join table:** ContentRowItem allows sortOrder per work per row (different order in different rows)
- **Placement enum:** Separates Homepage-only from Works-page-only from both
- **sortOrder:** Both row and item level — flexible ordering
- **active flag:** Deactivate rows without deleting
- **Cascade delete:** Removing a row removes its items automatically

---

## 10. Recommended Admin UI

### New page: `/admin/rows`

**Main view (list):**
- Table or card list of all rows
- Columns:
  1. Title (clickable to edit)
  2. Placement (HOME / WORKS / BOTH icon)
  3. Active (toggle switch)
  4. Item Count (number of works in row)
  5. Sort Order (number, or up/down buttons)
  6. Actions (Edit / Duplicate / Delete)

**Create row (modal or page):**
1. Row title (text input) — required
2. Row slug (auto-generated from title, or manual input)
3. Row description (optional textarea)
4. Placement (radio buttons: HOME, WORKS, BOTH)
5. Active toggle (checkbox, default true)
6. Save button

**Edit row (modal or page):**
1. All fields from Create
2. Items section:
   - Search/autocomplete to add works
   - List of works in row with:
     - Poster thumbnail
     - Title
     - Type badge
     - Sort order (number input or up/down buttons)
     - Remove button
3. Preview section (optional):
   - Show first 8 items as they'd appear in FilmRail
4. Save button

**Delete row:**
- Confirmation modal
- "This will remove X works from this row but not delete the works."
- OK / Cancel

---

## 11. Recommended Public Rendering Strategy

### Homepage:

**Current behavior (fallback if no custom rows):**
- Hero
- Continue Watching
- Featured Works
- New Releases
- Brand strip
- Studio Identity

**New behavior (if custom rows exist):**
- Hero
- Custom rows where placement = HOME or BOTH (ordered by sortOrder)
- Brand strip
- Studio Identity

**Query logic:**
```typescript
// Pseudo-code
const customRows = await prisma.contentRow.findMany({
  where: {
    placement: { in: ["HOME", "BOTH"] },
    active: true,
  },
  orderBy: { sortOrder: "asc" },
  include: {
    items: {
      orderBy: { sortOrder: "asc" },
      include: { work: { /* select fields */ } },
    },
  },
});

if (customRows.length > 0) {
  // Render custom rows
  renderCustomRows(customRows);
} else {
  // Render default Lite rows (Featured, New Releases, etc.)
  renderDefaultRows();
}
```

**Fallback:** Continue Watching can remain as user-specific row (not in ContentRow system yet — can be added later).

---

### Works Page:

**Current behavior (fallback if no custom rows):**
- Works grid with tab filtering (ALL, UPCOMING, FILMS, SERIES, SHORTS, etc.)

**New behavior (if custom rows exist):**
- Custom rows where placement = WORKS or BOTH (ordered by sortOrder)
- Optional: Preserve tab filtering OR replace with custom row tabs

**Decision:** Start with custom rows only. If tabs are desired alongside custom rows, that's a Phase 2 enhancement.

**Query logic:** Same as homepage but filter by WORKS or BOTH placement.

---

## 12. Fallback Strategy

**Rule:** If no custom rows exist, render current system.

**Implementation:**
- Check `prisma.contentRow.count()` where active = true
- If count === 0, use current code path
- If count > 0, use custom row rendering

**Benefits:**
- Zero disruption if admin hasn't created rows yet
- Can launch feature with no content, pages remain functional
- Admin gradually adopts as they create rows

---

## 13. Project Ordering Inside Rows

**Mechanism:** ContentRowItem.sortOrder

**Admin input:** Number field or up/down buttons in row edit page

**Example:**
```
Row: "Featured Works"
Items:
  - Papaoutai (sortOrder: 0) - first
  - Grandpa's Diary (sortOrder: 10) - second
  - Line of Sight (sortOrder: 20) - third
```

**Rendering:** Query with `orderBy: { sortOrder: "asc" }`

---

## 14. Row Positioning on Page

**Mechanism:** ContentRow.sortOrder

**Admin input:** Number field in row edit page

**Example:**
```
Rows on Homepage (by sortOrder):
  0 - Featured Works
  10 - New Releases
  20 - Trending
```

**Rendering:** Query with `orderBy: { sortOrder: "asc" }`

**Future enhancement:** Drag-and-drop. MVP uses number inputs.

---

## 15. Empty Row Handling

**Rule:** Do not display empty rows.

**Implementation:**
```typescript
// When rendering, filter out rows with no items
const nonEmptyRows = customRows.filter(row => row.items.length > 0);
```

---

## 16. Migration Required

**YES.** Two new models + one enum.

**Steps:**
1. Define models in schema.prisma (as above)
2. Create migration: `npx prisma migrate dev --name add_curated_rows`
3. Do NOT run db:push — migration handles it
4. Run `npx prisma generate` to regenerate client

---

## 17. Exact Files to Touch

### New files to create:
1. `app/admin/rows/page.tsx` — List rows
2. `app/admin/rows/[id]/page.tsx` — Edit row
3. `components/admin/row-manager.tsx` — Row form component
4. `components/admin/row-item-selector.tsx` — Work selection UI
5. `lib/actions/rows.ts` — Server actions for CRUD
6. `docs/lite-curated-row-manager-audit.md` — This audit (✓ done)

### Files to modify:
7. `prisma/schema.prisma` — Add ContentRow + ContentRowItem models
8. `app/(public)/page.tsx` — Render custom rows with fallback
9. `app/(public)/works/page.tsx` — Option to render custom rows (Phase 2 or later)
10. `components/admin-sidebar.tsx` — Add "Rows" link

### No changes needed:
- FilmRail — reused as-is
- FilmCard — reused as-is
- work-cta.ts — unaffected
- Work model — only relationship added, no field deletions

---

## 18. Risk Level Assessment

**Overall Risk:** LOW

### Why low:
- ✅ Greenfield feature (no existing code to break)
- ✅ Fallback to current system if no rows created
- ✅ Current featured/showOnHome behavior unaffected
- ✅ FilmRail/FilmCard reused (proven components)
- ✅ No client-side logic changes (server queries)
- ✅ Admin-only feature (no public risk)
- ✅ Many-to-many schema is standard pattern

### Mitigation:
- Test fallback carefully (pages with no custom rows)
- Test row deletion + cascade
- Test empty row filtering
- Performance test homepage with 10+ rows
- Mobile viewport test

---

## 19. Implementation Sequence After Approval

### Phase 1: Schema & Migration (30 min)
1. Update prisma/schema.prisma
2. Create migration
3. Run Prisma generate

### Phase 2: Admin Backend (1-2 hours)
4. Create `/lib/actions/rows.ts` (createRow, updateRow, deleteRow, addWork, removeWork, reorderWorks, reorderRows)
5. Add admin auth guard

### Phase 3: Admin UI (2-3 hours)
6. Create `/admin/rows/page.tsx` (list view)
7. Create `/admin/rows/[id]/page.tsx` (edit view)
8. Create `components/admin/row-manager.tsx` (form)
9. Create `components/admin/row-item-selector.tsx` (work picker)
10. Add "Rows" to admin sidebar

### Phase 4: Public Rendering (1-2 hours)
11. Update `app/(public)/page.tsx` to query and render custom rows with fallback
12. Test fallback behavior

### Phase 5: Testing (1-2 hours)
13. Create row, add works, verify on homepage
14. Test fallback with no custom rows
15. Test mobile layout
16. Test performance
17. TypeScript check

**Estimated total:** 6-9 hours

---

## 20. Testing Checklist After Implementation

**Admin:**
- [ ] Create new row "Featured Works" with placement HOME
- [ ] Add 5 works to row
- [ ] Change work order (drag/number inputs)
- [ ] Edit row (change title, description, placement)
- [ ] Toggle active on/off
- [ ] Delete row (confirm works not deleted)
- [ ] Create row with placement BOTH
- [ ] Create multiple rows, change row order

**Homepage:**
- [ ] Custom rows appear below hero
- [ ] Rows appear in correct order (by sortOrder)
- [ ] Works in row appear in correct order
- [ ] Empty rows don't display
- [ ] Deactivated rows don't display
- [ ] Works page filters still work if custom rows present
- [ ] FilmRail horizontal scroll works for custom rows
- [ ] FilmCard CTA works for works in custom rows
- [ ] Save button works for works in custom rows

**Fallback:**
- [ ] Delete all custom rows
- [ ] Homepage still renders default Featured + New Releases
- [ ] No 404 or errors

**Performance:**
- [ ] Homepage loads in <2s on 4G (mobile)
- [ ] No layout shift when custom rows render
- [ ] No horizontal overflow on mobile
- [ ] Image lazy loading works for cards

**Mobile:**
- [ ] Rows stack correctly
- [ ] Cards are correctly sized
- [ ] Scroll is smooth
- [ ] No jank on scroll

**Data:**
- [ ] TypeScript passes
- [ ] Migration applies cleanly
- [ ] No orphaned rows if work is deleted
- [ ] Works can appear in multiple rows

---

## 21. Future Enhancements (Phase 2+)

Out of scope for MVP:

- [ ] Drag-and-drop row reordering (use number inputs for MVP)
- [ ] Drag-and-drop work reordering within row
- [ ] Works page custom rows + tabs (decide on UI later)
- [ ] Row edit from Works page quick-actions
- [ ] Bulk add works to row
- [ ] Row templates/presets
- [ ] AI-generated rows based on viewing patterns
- [ ] Schedule rows (appear on specific date ranges)
- [ ] Row analytics (row views, clicks per row)

---

## Recommended Admin Label

**"Rows & Collections"**

or

**"Curated Rows"**

Both are clear. "Rows & Collections" is slightly more discoverable for new users.

---

## Next Steps

**This audit is complete.**

### To proceed:
1. ✅ Review this audit
2. ✅ Approve schema design (ContentRow + ContentRowItem)
3. ✅ Approve admin UI plan
4. ✅ Approve rendering strategy (custom rows + fallback)
5. ⏳ Request implementation

### Upon approval:
- Implementation will follow the 5-phase sequence above
- Migration will be created but NOT run (db:push not used)
- Estimated 6-9 hours
- Full test coverage before merge

---

**Audit prepared by:** Claude Code  
**Audit date:** 2026-06-05  
**Status:** Ready for approval  
**No code changes made during audit.**
