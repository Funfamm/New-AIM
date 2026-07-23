# TOKEN_SAVING_WORKFLOW — Claude Operating Rules

## Orient First (Before Any Task)

1. Read `claude-progress.md` — understand what is built, what is in progress, what is next.
2. Read `feature-list.json` — identify which module the task belongs to and its key files.
3. Check `.claude/skills/` for a skill file matching the task type before exploring the codebase.
4. Only then read application code — and only the files directly needed.

## Reading Strategy

- **Never** read a file speculatively. Have a specific reason.
- Use `Grep` to find symbols, patterns, imports before reading.
- Use `Glob` to list files before reading directories.
- Read only the lines you need with `offset` and `limit`.
- If a function name is known, grep for it rather than reading the full file.

## Task Execution

- State in one sentence what you found and what you will change before editing.
- Edit the minimum set of files. Do not cascade into adjacent code unless the task requires it.
- After editing, run `npx tsc --noEmit` — nothing else unless the task requires it.
- Commit with a clear message. Create a PR. Wait for merge instruction.

## After Every Task

Update `claude-progress.md`:
- Move completed items to the Completed section.
- Add any new in-progress or next items discovered during the task.
- Note any gaps found.

## Token Budget Rules

| Situation | Action |
|---|---|
| Need to understand a module | Read `feature-list.json` entry first |
| Need to add an email type | Read `.claude/skills/new-email-type.md` |
| Need to change the schema | Read `.claude/skills/schema-change.md` |
| Need to add an admin action | Read `.claude/skills/admin-action.md` |
| Need to add an admin page | Read `.claude/skills/new-admin-page.md` |
| Found a security issue | Read `docs/SECURITY_STANDARD.md` |
| Touching the database | Read `docs/DATABASE_SAFETY.md` |
| About to deploy | Read `docs/DEPLOYMENT_CHECKLIST.md` |

## What NOT To Do

- Do not read the entire `prisma/schema.prisma` to find one model — grep for it.
- Do not read a page file to understand the whole module — read `feature-list.json`.
- Do not re-read files already read in the session unless they changed.
- Do not write planning docs, analysis docs, or intermediate notes — work from conversation context.
- Do not add comments explaining what code does.
- Do not install packages without stating what they do and why they are needed.
- Do not leave TODO comments in code — either do it now or log it in `claude-progress.md`.
