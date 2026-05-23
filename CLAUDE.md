# AIM Studio Lite — Claude Rules

> This file governs how Claude Code behaves in this project.
> Reference: awesome-claude-code, ECC, agentic-saas-blueprint patterns.

---

## ⚠ Core Rules

1. **Only install a package when it is necessary for the current feature.**
   Before installing anything, check if it can be done in plain TypeScript.

2. **Never install packages speculatively** ("we might need this later").

3. **Mobile-first always.** Write mobile styles first, then `md:` and `lg:` breakpoints.

4. **Prefer React Server Components.** Only add `"use client"` when the component
   needs browser APIs, event handlers, or useState/useEffect.

5. **Prefer Server Actions over API routes** for form submissions and mutations.

6. **Always use Prisma** for DB access. Never raw SQL unless writing a migration.

7. **Always hash passwords with bcryptjs** before storing. Never store plain text.

8. **Always check role** before admin mutations in Server Actions (`requireAdmin()`).

9. **Keep components small** — if a file exceeds ~150 lines, split it.

10. **No inline styles in components** — use Tailwind utility classes.

---

## Stack

| Layer       | Choice                                         |
|-------------|------------------------------------------------|
| Framework   | Next.js 15 App Router                          |
| Language    | TypeScript (strict mode)                       |
| Styling     | Tailwind CSS v4 (CSS-first, `@theme` tokens)   |
| UI          | shadcn/ui copy-paste only — no `npx shadcn add`|
| Database    | Neon (serverless Postgres)                     |
| ORM         | Prisma                                         |
| Auth        | Auth.js v5 — credentials only in v1            |
| Video       | Native `<video>` / `<iframe>` — no video lib   |
| Icons       | lucide-react (already installed)               |
| Deployment  | Vercel                                         |

---

## Folder conventions

- `/app/(public)/`    — public-facing pages
- `/app/(auth)/`      — login, register
- `/app/admin/`       — admin dashboard (role-gated in middleware)
- `/app/dashboard/`   — logged-in user area
- `/components/ui/`   — copy-pasted shadcn primitives
- `/lib/actions/`     — all Server Actions
- `/lib/prisma.ts`    — singleton Prisma client
- `/lib/auth.ts`      — Auth.js config
- `/lib/utils.ts`     — cn(), slugify(), formatDuration()

---

## Design tokens (use these, not arbitrary values)

```css
--color-brand-black:    #0a0a0a   /* page background */
--color-brand-dark:     #111111   /* card background */
--color-brand-surface:  #1a1a1a   /* elevated surfaces */
--color-brand-border:   #2a2a2a   /* borders */
--color-brand-muted:    #6b7280   /* secondary text */
--color-brand-light:    #e5e7eb   /* body text */
--color-brand-white:    #f9fafb   /* headings */
--color-brand-accent:   #e8c97e   /* cinematic gold — CTAs, highlights */
--color-brand-red:      #c0392b   /* errors, danger */
--font-display:         "Playfair Display", Georgia, serif
--font-body:            "DM Sans", system-ui, sans-serif
```

---

## Do NOT build in v1

- Multilingual / i18n system
- Watch party
- Advanced AI automation
- Complex RAG / memory system
- Notification system
- Casting system
- Training hub
- Payment / subscription system
- Complex analytics

---

## Reference repos (do not install into production)

| Repo                  | Purpose                                      |
|-----------------------|----------------------------------------------|
| agentic-saas-blueprint | Structure and Claude workflow reference      |
| ui-ux-pro-max-skill   | UI quality checklist                         |
| magic-mcp             | Component design inspiration                 |
| awesome-claude-code   | Claude Code hooks and slash commands         |
| ECC / superpowers / GSD | Claude workflow rules                      |
| claude-mem / LightRAG | Future memory — do not build yet             |
| n8n-MCP / Ruflo       | Future automation — do not build yet         |
