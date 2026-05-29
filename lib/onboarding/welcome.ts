// lib/onboarding/welcome.ts
// Welcome flow — runs once per user account on first login/registration.
//
// ensureWelcomeForUser(userId):
//   1. Loads user + welcome timestamps.
//   2. Atomically claims the email send slot (updateMany WHERE field IS NULL).
//      — Prevents race-condition duplicates when multiple async callers
//        (e.g. signIn callback) check the field before either has stamped it.
//   3. Sends welcome email via Microsoft Graph if claim succeeded.
//   4. Rolls back the timestamp if the send fails so it can be retried.
//   5. Same atomic pattern for the in-app welcome notification.
//   6. Never throws — never blocks auth flow.
//   7. Idempotent — safe to call any number of times.
//
// Provider notes:
//   - Email: Microsoft Graph (transactional, not ACS bulk).
//   - Notification: direct Prisma insert (not createBulkInAppNotification — single user).
//   - Both paths are fire-and-forget from the auth callback perspective.

import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Ensure the welcome email and welcome notification have been sent exactly once
 * for this user. Safe to call on every sign-in — atomic checks prevent duplicate
 * sends even when called concurrently from multiple async paths.
 *
 * Never throws — all errors are caught so auth is never blocked.
 */
export async function ensureWelcomeForUser(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: {
        id:                        true,
        email:                     true,
        name:                      true,
        welcomeEmailSentAt:        true,
        welcomeNotificationSentAt: true,
      },
    });

    if (!user) return;

    // ── Welcome email ─────────────────────────────────────────────────────
    // Fast-path: both timestamps already set — nothing to do.
    if (user.welcomeEmailSentAt && user.welcomeNotificationSentAt) return;

    if (!user.welcomeEmailSentAt) {
      // Atomic claim: only the process that successfully sets the timestamp
      // from NULL proceeds to send. Concurrent callers get count=0 and skip.
      const emailClaim = await prisma.user.updateMany({
        where: { id: userId, welcomeEmailSentAt: null },
        data:  { welcomeEmailSentAt: new Date() },
      });

      if (emailClaim.count > 0) {
        // We won the race — send the email.
        try {
          await sendWelcomeEmail(user.email, user.name);
        } catch {
          // Send failed — roll back the timestamp so the next login can retry.
          // Auth is never blocked; worst case the user gets their welcome slightly late.
          await prisma.user.update({
            where: { id: userId },
            data:  { welcomeEmailSentAt: null },
          }).catch(() => {});
        }
      }
      // count === 0 means another process already claimed it; nothing to do.
    }

    // ── Welcome in-app notification ───────────────────────────────────────
    if (!user.welcomeNotificationSentAt) {
      const notifClaim = await prisma.user.updateMany({
        where: { id: userId, welcomeNotificationSentAt: null },
        data:  { welcomeNotificationSentAt: new Date() },
      });

      if (notifClaim.count > 0) {
        try {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type:   "ACCOUNT",
              title:  "Welcome to AIM Studio",
              body:   "Start watching, save your favorite works, and continue where you left off.",
              href:   `${APP_URL}/works`,
              read:   false,
            },
          });
        } catch {
          // Notification failed — roll back so next login retries.
          await prisma.user.update({
            where: { id: userId },
            data:  { welcomeNotificationSentAt: null },
          }).catch(() => {});
        }
      }
    }
  } catch {
    // Outer catch: any unexpected error is swallowed — auth must never be blocked.
  }
}
