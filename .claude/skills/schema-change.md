# Skill: Safely Change the Database Schema

## When to use
Adding a column, adding a model, adding an index, or any Prisma schema edit.

## Steps

### Adding a nullable column or new model (safe)
1. Edit `prisma/schema.prisma`.
2. Write a migration SQL file: `prisma/migrations/YYYYMMDDHHMMSS_description/migration.sql`.
   - Naming: use UTC timestamp + snake_case description.
   - For new column: `ALTER TABLE "table_name" ADD COLUMN "columnName" TYPE;`
   - For new model: full `CREATE TABLE` statement.
   - For unique index: `CREATE UNIQUE INDEX "name" ON "table"("col");`
3. Run `npx prisma generate` to update the client types.
4. Run `npx tsc --noEmit` to verify type safety.
5. Deploy with `npx prisma migrate deploy` (runs pending migrations against the DB).

### Destructive changes (DROP, rename, type change) — two-step process
Step 1: Deploy code that no longer reads/writes the old column → merge and deploy.
Step 2: Deploy the migration that removes or renames it → merge and deploy.
Never do both in one PR.

### What NOT to do
- Never `npx prisma db push` on production.
- Never edit an already-deployed migration file.
- Never run `migrate dev` against the production DB (shadow DB error on Neon serverless).

## Key files
- `prisma/schema.prisma`
- `prisma/migrations/`
- `docs/DATABASE_SAFETY.md` — full rules
