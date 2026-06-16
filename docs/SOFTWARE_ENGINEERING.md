# AIM Studio Lite — Software Engineering Safety & Scaling Standard

## 1. Purpose

This document defines the engineering rules required to keep AIM Studio Lite safe, scalable, recoverable, and production-ready as the platform grows.

## 2. Core Principle

AIM Studio Lite must be built as a secure, modular, observable, and recoverable platform. No feature is complete until it is safe, tested, monitored, and reversible.

## 3. Architecture Standard

- Public layer must remain fast, lightweight, cache-friendly, and mobile-first.
- User layer must protect account data, watch progress, saved works, and notification preferences.
- Admin layer must be private, role-protected, audited, and separated from public performance paths.
- Heavy work must not run inside public page requests.

## 4. Security Rules

- No hardcoded admin access.
- No public admin APIs.
- Every admin route must verify session and role server-side.
- Every user-owned record must verify ownership before read/write.
- Password reset must use verified existing email/code flow.
- Google users must verify email before creating a password.
- Secrets must live only in environment variables.
- All admin actions must be audit logged.
- Security headers and CSP must be enabled.

See `docs/SECURITY_STANDARD.md` for the full security reference.

## 5. Database Rules

- Production database must never be used for risky experiments.
- All schema changes must be tested on a branch/preview database first.
- Backups and point-in-time restore must be enabled and tested.
- Critical writes must use transactions.
- Serverless database access must use connection pooling.
- All queries must have pagination or safe limits.

See `docs/DATABASE_SAFETY.md` for the full database reference.

## 6. Scaling Rules

- Start as a modular monolith.
- Split services only when there is measured scaling pressure.
- Use queues for video processing, subtitles, emails, analytics, and AI jobs.
- Use CDN/caching for public media and static assets.
- Avoid loading heavy media before user intent.

See `docs/SCALING_STANDARD.md` for the full scaling reference.

## 7. Background Job Rules

- Every job must have status tracking.
- Every job must support retry/failure visibility.
- Failed jobs must not disappear silently.
- Admin must be able to retry/reset stalled jobs.
- Long-running jobs must not block user-facing requests.

## 8. API Rules

- Validate all inputs.
- Rate limit public and expensive endpoints.
- Use idempotency keys for repeatable write operations.
- Never trust client-side authorization.
- Log suspicious behavior.

## 9. Observability Rules

- Track errors, latency, uptime, database health, queue failures, and admin actions.
- Every production incident must produce a short incident report.
- The system must answer: what failed, who was affected, when it started, and how to prevent it again.

See `docs/INCIDENT_RESPONSE.md` for the incident playbook.

## 10. Release Rules

- No direct production changes without build validation.
- Every PR must pass build, lint, type check, dependency audit, and critical tests.
- Preview deployments must be reviewed before production merge.
- Rollback steps must be known before major releases.

See `docs/DEPLOYMENT_CHECKLIST.md` for the full release checklist.

## 11. AI/Agent Rules

- AI agents must not receive production secrets.
- AI agents must not directly modify production data without approval.
- Tools must be sandboxed and permission-limited.
- Destructive actions require human confirmation.
- Agent activity must be logged.

See `docs/AI_AGENT_SAFETY.md` for the full agent safety reference.

## 12. Definition of Done

A feature is not complete until:

- It works for users.
- It works on mobile.
- It handles errors.
- It is secure.
- It does not break scaling rules.
- It is tested.
- It is observable.
- It can be rolled back.
