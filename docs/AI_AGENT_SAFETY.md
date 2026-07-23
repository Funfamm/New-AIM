# AIM Studio Lite — AI Agent Safety

## Scope

This document covers safety rules for all AI agents and coding assistants (Claude Code, Cursor, Copilot, or any LLM-assisted tool) working on AIM Studio Lite.

## What Agents May Do

- Read, write, and edit source code files.
- Run `npm run build`, `npm run lint`, `npx tsc --noEmit` to validate changes.
- Create and run database migrations on a **branch or preview database only**.
- Create and push branches and pull requests.
- Read environment variable names from `.env.local.example` — never values.

## What Agents Must Not Do

- Access, print, log, or output any environment variable value (API keys, secrets, connection strings, tokens).
- Run `prisma migrate deploy` or `prisma db push` against the **production database**.
- Push directly to `main`. All changes go through a PR.
- Merge PRs without human review and approval.
- Delete production data or production database records.
- Modify Vercel project settings, environment variables, or domain configuration.
- Send real emails during development or testing.
- Access or modify billing, payment, or subscription infrastructure.
- Make changes to CI/CD pipeline configuration without explicit human instruction.

## Secrets Rule (Zero Tolerance)

Agents must never print, log, echo, or include in any output:

- Database connection strings
- API keys (Azure, R2, ACS, Graph, Resend, or any third party)
- Auth secrets (`AUTH_SECRET`, JWT signing keys)
- OAuth client secrets
- Any value read from `.env` or `.env.local`

If an agent needs to verify that an environment variable exists, it checks the **name** only, never the value. Output format: `AZURE_CLIENT_ID: [set]` or `AZURE_CLIENT_ID: [missing]`.

## Destructive Action Protocol

Before any action that cannot be undone, the agent must:

1. State clearly what the destructive action is.
2. State what will be lost or changed permanently.
3. Ask for explicit human confirmation.
4. Wait for confirmation before proceeding.

Destructive actions include: deleting files, dropping database tables or columns, deleting records, resetting migrations, force-pushing branches, clearing queues, or removing user data.

## Production Data

- Agents must not be given access to the production `DATABASE_URL`.
- If debugging requires looking at production data, a human must retrieve and sanitize the data before sharing it with the agent.
- Agents work against local, development, or preview database environments only.

## Agent Activity Logging

When an AI agent makes a significant change (new file, schema change, new Server Action, security-related edit), the change must be visible in the git commit history with a clear message describing what was changed and why.

Agent-authored commits must include:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Verification Before Shipping

After an agent implements a feature or fix:

1. Human reviews the full diff before merging.
2. Human verifies the build passes (`npm run build`).
3. Human verifies no secrets appear in the diff.
4. Human tests the feature in a preview deployment.
5. Human merges — not the agent.

## Coding Assistant Rules

These apply to all sessions with any AI coding assistant:

- The assistant follows `CLAUDE.md` as the primary instruction file.
- The assistant follows `docs/SOFTWARE_ENGINEERING.md` as the safety and scaling standard.
- The assistant must read relevant docs before making architectural decisions.
- The assistant must not install new packages without stating what the package does and why it is needed.
- The assistant must not refactor code beyond the scope of the current task.
- The assistant must not add features, abstractions, or error handling for hypothetical future cases.
