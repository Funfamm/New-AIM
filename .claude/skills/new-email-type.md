# Skill: Add a New Email Type

## When to use
Adding a new transactional email (e.g. a new notification, alert, or status email).

## Steps

1. **Add the EmailType enum value** — `prisma/schema.prisma`, `enum EmailType`.
2. **Create a migration** — write SQL: `ALTER TYPE "EmailType" ADD VALUE 'NEW_TYPE';`
   Save to `prisma/migrations/TIMESTAMP_add_email_type_xxx/migration.sql`.
3. **Run `npx prisma generate`** to regenerate the client.
4. **Write the email function** — add to `lib/email.ts` (transactional) or a domain-specific file like `lib/casting/casting-emails.ts`.
   - Use `premiumTransactionalEmail()` from `lib/email-base.ts` for the HTML template.
   - Pass `imageUrl` if there is a project poster to show.
   - Call `sendEmail({ to, subject, html, type: "NEW_TYPE" })`.
5. **Call the function** from the relevant Server Action — always fire-and-forget with `.catch(() => {})` for non-critical emails.
6. **Check suppression** — `sendEmail()` checks suppression automatically. Do not add your own check.
7. **Verify** — run the action in dev, check the admin Email → Logs tab for the sent record.

## Key files
- `lib/email.ts` — `sendEmail()`, transactional sender
- `lib/email-base.ts` — `premiumTransactionalEmail()` HTML layout
- `lib/email-tracking.ts` — tracking pixel and click wrapping (applied automatically in `sendEmail`)
- `prisma/schema.prisma` — `EmailType` enum
