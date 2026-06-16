# Skill: Add a New Admin Page

## When to use
Adding a new section to the admin dashboard.

## Steps

1. **Check `docs/ADMIN_DASHBOARD_BLUEPRINT.md`** — confirm the module is approved for v1. Do not build modules listed as Future.

2. **Create the route** — `app/admin/{module}/page.tsx`.
   - Server Component (no `"use client"`).
   - First line: `await requireAdmin()` (import from `lib/auth-guard.ts`).

3. **Fetch data** — query Prisma directly in the Server Component. Use `select` and `take` limits.

4. **Serialize dates** — convert `Date` objects to ISO strings before passing to client components:
   ```typescript
   const rows = data.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
   ```

5. **Separate client interactivity** — create `{module}-table.tsx` or `{module}-form.tsx` as `"use client"` components for anything with state, transitions, or event handlers.

6. **Wire actions** — client components call Server Actions from `lib/actions/`. Use `useTransition` for pending states.

7. **Add to admin sidebar** — `components/admin-sidebar.tsx`. Follow the existing pattern (icon + label + href).

8. **CSS** — add a `{module}.css` file in the page folder if custom styles are needed. Import into the page. Use brand tokens only.

9. **Verify** — navigate to the page as an admin. Check mobile layout at 375px.

## Pattern reference
- Simplest: `app/admin/notify-me-ctas/page.tsx`
- With client bulk actions: `app/admin/email/tab-queue.tsx` + `queue-table.tsx`
- With form: `app/admin/notify-me-ctas/[ctaId]/cta-form.tsx`
