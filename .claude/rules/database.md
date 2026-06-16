# Database Rules (summary — full detail in docs/DATABASE_SAFETY.md)

- Never `prisma db push` on production. Use `prisma migrate deploy`.
- Test migrations on a Neon branch database first.
- Destructive migrations (DROP, rename, type change) require two steps: deploy code first, then migrate.
- Every `findMany` must have a `take` limit (max 500).
- Multi-table writes must use `prisma.$transaction`.
- Use `select` — never fetch all columns on hot paths.
- Prisma client is a singleton in `lib/prisma.ts`. Never create new instances per request.
- `DATABASE_URL` must point to the Neon pooler endpoint for serverless. Direct URL for migrations only.
