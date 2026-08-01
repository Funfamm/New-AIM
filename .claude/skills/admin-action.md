# Skill: Add a New Admin Server Action

## When to use
Adding a new admin operation (bulk action, status change, delete, config update, etc.).

## Steps

1. **Choose the right file** — group by domain:
   - Email admin: `lib/actions/email-admin.ts`
   - Casting admin: `lib/actions/casting.ts`
   - User admin: `lib/actions/users-admin.ts`
   - Works admin: `lib/actions/works.ts`
   - New domain: create `lib/actions/{domain}-admin.ts`

2. **Start with `"use server"`** at the top of the file.

3. **Call `requireAdmin()`** as the first line of every admin action:
   ```typescript
   const admin = await requireAdmin();
   ```

4. **Validate inputs** — check types, lengths, allowed values before any DB call.

5. **Write to DB** — use Prisma. Use `prisma.$transaction` for multi-table writes.

6. **Audit log** — for destructive or status-changing actions:
   ```typescript
   writeAudit({
     actorId:    admin.id,
     actorEmail: admin.email ?? "",
     targetId:   entityId,
     action:     "ACTION_NAME",
     detail:     optionalDetail,
   }).catch(() => {});
   ```

7. **Revalidate** — call `revalidatePath("/admin/relevant-path")` after mutations.

8. **Return** `{ ok: boolean; error?: string }` — consistent shape for all admin actions.

9. **Wire to UI** — call from a client component using `useTransition` or `useActionState`.

## Key files
- `lib/auth-guard.ts` — `requireAdmin()`
- `lib/audit.ts` — `writeAudit()`
- `lib/prisma.ts` — Prisma client
