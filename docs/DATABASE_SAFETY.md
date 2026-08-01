# AIM Studio Lite — Database Safety

## Schema Changes

- Never run `prisma db push` on the production database. It bypasses migration history and can cause data loss.
- All schema changes must go through `prisma migrate dev` (creates a migration file) → reviewed → deployed via `prisma migrate deploy`.
- Test every migration on a branch or preview database before merging to main.
- Destructive migrations (DROP COLUMN, DROP TABLE, data type changes) require a two-step process:
  1. Deploy code that no longer reads/writes the column.
  2. Deploy the migration that removes it.
- Never rename a column in one step. Add new → migrate data → drop old.

## Migration Files

- Migration SQL files are in `prisma/migrations/`. Never edit an already-deployed migration.
- If a migration needs to be corrected after deployment, write a new migration that fixes it.
- Shadow database errors (`P3006`) on Neon: use `prisma migrate deploy` (not `migrate dev`) which skips the shadow DB requirement for serverless Postgres.

## Backups & Recovery

- Neon point-in-time restore must be enabled on the production project.
- Verify restore capability at least once per quarter — a backup that has never been tested is not a backup.
- Before any large data migration or destructive operation, manually snapshot or export the affected tables.
- Know the restore procedure before you need it: Neon → Project → Restore.

## Transactions

- Any operation that writes to multiple tables as a logical unit must use a Prisma transaction (`prisma.$transaction`).
- Examples that require transactions: creating a casting application + its media records; processing a bulk email batch + logging; updating a work's status + related records.
- Do not write partial state to the database. If step 2 can fail, wrap steps 1+2 in a transaction.

## Connection Pooling

- In serverless environments (Vercel), always use the Neon connection pooler endpoint (PgBouncer), not the direct connection string.
- `DATABASE_URL` in `.env` should point to the pooler. The direct URL is only needed for migrations (`prisma migrate deploy`).
- The Prisma client is a singleton in `lib/prisma.ts` — do not instantiate new PrismaClient instances per request.

### How to get the pooler URL (Neon)

1. Open [console.neon.tech](https://console.neon.tech) → your project → **Connection Details**.
2. In the connection string selector, choose **Pooled connection** (not Direct).
3. The pooler URL looks like: `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require`
4. Set this as `DATABASE_URL` in Vercel → Settings → Environment Variables.
5. For migrations only, use the **Direct connection** URL via `DIRECT_URL` in Prisma schema:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // pooler — used by app
  directUrl = env("DIRECT_URL")        // direct — used by prisma migrate deploy
}
```

## Backups & Point-in-Time Restore (PITR)

### Enabling PITR on Neon

1. Open [console.neon.tech](https://console.neon.tech) → your project.
2. Go to **Settings** → **Storage** — verify that **Point-in-Time Restore** is available and active (included on paid plans).
3. Neon retains up to 7 days of history on the Free plan, 30 days on paid plans.

### Testing restore (do this quarterly)

1. In Neon console → **Restore** → select a timestamp from 24h ago.
2. Neon creates a new branch from that point in time.
3. Verify the branch database contains the expected data.
4. Delete the test branch after verification.
5. Log the test date in the incident log.

### Pre-operation snapshot

Before any large data migration or destructive operation:
1. In Neon console → **Branches** → **Create branch** → name it `backup-YYYY-MM-DD`.
2. Run the migration.
3. If the migration succeeds, delete the branch. If it fails, restore from the branch.

## Query Safety

- Every `findMany` must have a `take` limit. Default maximum: 500 rows unless there is an explicit pagination pattern.
- Never fetch all rows from a large table to count them — use `prisma.model.count()`.
- Use `select` to fetch only the columns you need. Avoid `include: { everything: true }` on hot paths.
- Add database indexes for: foreign keys used in joins, columns used in `WHERE` or `ORDER BY` on high-traffic queries, unique constraint columns.
- Soft-delete patterns (setting `active = false`) must include a filter in every query that reads active records. Dead records must not leak into public responses.

## Data Integrity

- Email addresses must always be stored lowercase. Normalize at write time, not read time.
- Tokens (tracking tokens, reset tokens, welcome tokens) must be generated with `crypto.randomUUID()` or equivalent cryptographic source.
- Sensitive fields (passwords, tokens) must never appear in logs, error messages, or API responses.
- Cascade deletes must be intentional. Review Prisma `onDelete` settings before adding relations.

## Production Access

- Production database credentials must never be shared in chat, email, or code comments.
- Direct production database access (Prisma Studio, psql) must be restricted to authorized engineers and logged.
- No ad-hoc `UPDATE` or `DELETE` statements on production without a written rollback plan.
