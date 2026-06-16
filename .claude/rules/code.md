# Code Rules

- No changes outside the scope of the current task.
- No refactoring of working code unless explicitly asked.
- No new packages without stating what they do and why.
- No inline styles — Tailwind utilities only.
- No `"use client"` unless hooks, events, or browser APIs are required.
- No raw SQL except in migration files.
- Every admin Server Action must call `requireAdmin()` first.
- Every user-data Server Action must verify `userId === session.user.id`.
- No `console.log` left in committed code.
- After edits: run `npx tsc --noEmit`. Fix errors before committing.
