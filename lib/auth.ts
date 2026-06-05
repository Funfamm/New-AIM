// Auth.js v5 (NextAuth) configuration
// Strategy: JWT (required for credentials provider)
// Providers: Credentials + Google OAuth
//
// Security additions:
//  - Login attempt tracking (LoginAttempt table)
//  - Rate limiting via checkLoginThrottle()
//  - lastLoginAt / lastLoginProvider updated on success
//  - Device fingerprint upserted on success (new device → alert)
//  - SecurityEvent written for every significant outcome

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
// Security utilities are dynamically imported inside callbacks to avoid
// bundling node:crypto into the Edge runtime (used by middleware for JWT only).
import { sendSecurityAlertEmail } from "@/lib/email";
import { ensureWelcomeForUser } from "@/lib/onboarding/welcome";

// Helper — extract raw request headers (no hashing — done in callbacks after dynamic import)
function extractRawContext(request?: Request) {
  const ua      = request?.headers.get("user-agent")          ?? "";
  const lang    = request?.headers.get("accept-language")     ?? "";
  const country = request?.headers.get("x-vercel-ip-country") ?? "";
  const region  = request?.headers.get("x-vercel-ip-region")  ?? "";
  const city    = request?.headers.get("x-vercel-ip-city")    ?? "";
  const ip      = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return { ua, lang, country, region, city, ip };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error:  "/login",
  },

  providers: [
    // allowDangerousEmailAccountLinking: when a Google email matches an existing
    // credentials user, the adapter links the Google account to that user instead
    // of blocking. Google verifies email ownership, so this is safe.
    Google({ allowDangerousEmailAccountLinking: true }),

    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email    = (credentials?.email    as string | undefined)?.toLowerCase().trim() ?? "";
        const password = (credentials?.password as string | undefined) ?? "";

        if (!email || !password) return null;

        const raw = extractRawContext(request as Request | undefined);

        // Dynamic import keeps node:crypto out of the Edge bundle
        const sec = await import("@/lib/security");

        const ipHash        = raw.ip ? sec.hashValue(raw.ip)  : undefined;
        const userAgentHash = raw.ua ? sec.hashValue(raw.ua)  : undefined;
        const fpHash        = raw.ua
          ? sec.buildFingerprintHash({ userAgent: raw.ua, acceptLanguage: raw.lang, country: raw.country })
          : undefined;
        const parsed = sec.parseUserAgent(raw.ua);

        // ── Rate limit check ───────────────────────────────────
        const throttle = await sec.checkLoginThrottle(email, ipHash ?? null);
        if (throttle.blocked) {
          void sec.recordLoginAttempt({
            email, provider: "credentials", success: false, failureReason: "BLOCKED",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          void sec.writeSecurityEvent({
            type: "LOGIN_BLOCKED", severity: "HIGH",
            email, provider: "credentials",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
            metadata: { failureCount: throttle.failureCount },
          });
          return null;
        }

        // ── User lookup ────────────────────────────────────────
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user || !user.password) {
          void sec.recordLoginAttempt({
            email, provider: "credentials", success: false, failureReason: "USER_NOT_FOUND",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          void sec.writeSecurityEvent({
            type: "LOGIN_FAILED", severity: "LOW",
            email, provider: "credentials",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          return null;
        }

        // ── Password check ─────────────────────────────────────
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          void sec.recordLoginAttempt({
            email, userId: user.id, provider: "credentials", success: false,
            failureReason: "INVALID_PASSWORD",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });

          const newFailureCount = throttle.failureCount + 1;
          const severity = newFailureCount >= 8 ? "HIGH" : newFailureCount >= 4 ? "MEDIUM" : "LOW";
          void sec.writeSecurityEvent({
            userId: user.id, type: "LOGIN_FAILED", severity,
            email, provider: "credentials",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
            metadata: { failureCount: newFailureCount },
          });

          if (newFailureCount >= 4) {
            void sec.createSecurityAlert({
              userId: user.id, severity: "MEDIUM", type: "LOGIN_FAILED",
              title: "Multiple failed sign-in attempts",
              message: `We detected ${newFailureCount} failed sign-in attempts on your account. If this was not you, reset your password.`,
              metadata: { email, country: raw.country },
            });
            void sendSecurityAlertEmail({
              to:          user.email,
              title:       "Multiple failed sign-in attempts",
              body:        `We noticed ${newFailureCount} failed attempts to sign in to your AIM Studio account${raw.country ? ` from ${raw.country}` : ""}. If this was not you, reset your password immediately.`,
              actionUrl:   `${process.env.NEXT_PUBLIC_APP_URL}/forgot-password`,
              actionLabel: "Reset Password",
            }).catch(() => {});
          }
          return null;
        }

        // ── Status check ───────────────────────────────────────
        if (user.status === "SUSPENDED") {
          void sec.recordLoginAttempt({
            email, userId: user.id, provider: "credentials", success: false,
            failureReason: "SUSPENDED",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          return null;
        }
        if (user.status === "DEACTIVATED" || user.status === "DELETED") {
          void sec.recordLoginAttempt({
            email, userId: user.id, provider: "credentials", success: false,
            failureReason: "DEACTIVATED",
            ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
          });
          return null;
        }

        // ── Success ────────────────────────────────────────────
        void sec.recordLoginAttempt({
          email, userId: user.id, provider: "credentials", success: true,
          ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
        });
        void prisma.user.update({
          where: { id: user.id },
          data:  { lastLoginAt: new Date(), lastLoginProvider: "credentials" },
        }).catch(() => {});
        void sec.writeSecurityEvent({
          userId: user.id, type: "CREDENTIALS_SIGN_IN", severity: "INFO",
          email, provider: "credentials",
          ipHash, userAgentHash, country: raw.country, region: raw.region, city: raw.city,
        });

        // Device fingerprint — new-device detection
        if (fpHash) {
          void (async () => {
            try {
              const isNew = await sec.upsertUserDevice({
                userId: user.id, fingerprintHash: fpHash,
                browser: parsed.browser, os: parsed.os, deviceType: parsed.deviceType,
                country: raw.country, region: raw.region, city: raw.city,
              });
              if (isNew) {
                void sec.writeSecurityEvent({
                  userId: user.id, type: "NEW_DEVICE_LOGIN", severity: "MEDIUM",
                  email, provider: "credentials",
                  ipHash, userAgentHash, deviceFingerprintHash: fpHash,
                  country: raw.country, region: raw.region, city: raw.city,
                  metadata: { browser: parsed.browser, os: parsed.os },
                });
                void sec.createSecurityAlert({
                  userId: user.id, severity: "MEDIUM", type: "NEW_DEVICE_LOGIN",
                  title: "New device sign-in",
                  message: `Your account was accessed from a new device (${parsed.browser}, ${parsed.os})${raw.country ? ` in ${raw.country}` : ""}.`,
                  metadata: { browser: parsed.browser, os: parsed.os, country: raw.country },
                });
                void sendSecurityAlertEmail({
                  to:    user.email,
                  title: "New device sign-in",
                  body:  `We noticed a sign-in to your AIM Studio account from a new device — ${parsed.browser} on ${parsed.os}${raw.country ? `, ${raw.country}` : ""}.`,
                }).catch(() => {});
              }
            } catch { /* device tracking must never block auth */ }
          })();
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role, tokenVersion: user.tokenVersion };
      },
    }),
  ],

  callbacks: {
    // ── signIn callback ──────────────────────────────────────────────────────
    // Runs for all providers after credentials are validated / OAuth token exchanged.
    //
    // Google OAuth: status check, welcome flow (awaited), lastLoginAt, security events.
    //
    // Credentials: welcome-flow backstop only.  registerUser() also fires it via
    // await, but the signIn callback is a safety net so it always finishes.
    // ensureWelcomeForUser is idempotent — safe to call twice on first registration;
    // for returning users it exits immediately after a single findUnique check.
    async signIn({ user, account }) {
      // ── Credentials backstop — awaited so Vercel does not exit before send ──
      if (account?.provider === "credentials" && user.id) {
        await ensureWelcomeForUser(user.id);
      }

      if (account?.provider === "google" && user.email) {
        // Look up by email rather than user.id — in Auth.js v5 with PrismaAdapter
        // the user.id in OAuth callbacks can be the provider sub (e.g. the Google
        // numeric ID) rather than the database CUID, which would cause findUnique
        // by ID to return null and silently skip the welcome flow.
        // Email is always the reliable key for OAuth users.
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase().trim() },
          select: { status: true, email: true, id: true, lastLoginAt: true },
        });
        if (
          dbUser?.status === "SUSPENDED" ||
          dbUser?.status === "DEACTIVATED" ||
          dbUser?.status === "DELETED"
        ) return false;

        if (dbUser) {
          // ── Welcome flow for Google OAuth ──────────────────────────────
          // AWAITED so Vercel does not exit before the email is sent.
          // ensureWelcomeForUser is idempotent — safe for repeat logins;
          // for returning users it exits immediately after checking the
          // welcomeEmailSentAt / welcomeNotificationSentAt timestamps.
          // Uses dbUser.id (database CUID) — user.id can be the Google sub.
          console.log(`[auth] Google signIn: calling ensureWelcomeForUser for ${dbUser.email} (dbId: ${dbUser.id})`);
          await ensureWelcomeForUser(dbUser.id).catch(() => {});

          void prisma.user.update({
            where: { id: dbUser.id },
            data:  { lastLoginAt: new Date(), lastLoginProvider: "google" },
          }).catch(() => {});

          // Dynamic import — security utilities are server-only
          void import("@/lib/security").then(async (sec) => {
            void sec.writeSecurityEvent({
              userId: dbUser.id, type: "GOOGLE_SIGN_IN", severity: "INFO",
              email: dbUser.email, provider: "google",
            });
            const isNew = await sec.upsertUserDevice({
              userId:          dbUser.id,
              fingerprintHash: sec.hashValue(`google|${dbUser.id}|oauth`),
              browser:         "Google OAuth",
              os:              "Unknown",
              deviceType:      "UNKNOWN",
            });
            // Only alert when it is a genuinely new device AND the user has
            // logged in before — first registration must never trigger alerts.
            const isGoogleFirstLogin = !dbUser.lastLoginAt;
            if (isNew && !isGoogleFirstLogin) {
              void sec.writeSecurityEvent({
                userId: dbUser.id, type: "NEW_DEVICE_LOGIN", severity: "LOW",
                email: dbUser.email, provider: "google",
                metadata: { note: "Google OAuth — full device details unavailable at callback" },
              });
            }
          }).catch(() => {});
        }
      }
      return true;
    },

    // Attach role and id to the JWT token.
    // On every subsequent request (user is undefined), verify the account still
    // exists in the DB. Returning null clears the session cookie immediately —
    // purged users become guests on their next page load.
    async jwt({ token, user, account }) {
      if (user) {
        // ── Initial sign-in ──────────────────────────────────────
        token.id = user.id;
        if (account?.type === "oauth") {
          // user.id for OAuth can be the Google sub (numeric provider ID) rather
          // than the database CUID. Look up by email to get the real DB record.
          const oauthEmail = (user.email ?? "").toLowerCase().trim();
          const dbUser = oauthEmail
            ? await prisma.user.findUnique({
                where:  { email: oauthEmail },
                select: { id: true, role: true, tokenVersion: true },
              })
            : await prisma.user.findUnique({
                where:  { id: user.id! },
                select: { id: true, role: true, tokenVersion: true },
              });
          token.role         = dbUser?.role         ?? "USER";
          token.tokenVersion = dbUser?.tokenVersion ?? 0;
          // Patch token.id to the real DB CUID so all downstream code works correctly.
          if (dbUser) token.id = dbUser.id;
          // Welcome flow — idempotent backstop. The primary call is in the signIn
          // callback (which uses the correct DB id from an email lookup). This is
          // a safety net in case signIn was skipped or the user wasn't found there.
          if (dbUser) {
            console.log(`[auth] jwt OAuth: ensureWelcomeForUser backstop for dbId ${dbUser.id}`);
            await ensureWelcomeForUser(dbUser.id).catch(() => {});
          }
        } else {
          token.role         = (user as { role?: string }).role ?? "USER";
          token.tokenVersion = (user as { tokenVersion?: number }).tokenVersion ?? 0;
        }
      } else if (token?.id) {
        // ── Subsequent requests — verify user still exists + token not revoked ──
        // Skipped in Edge runtime (middleware) where Prisma is unavailable.
        // Runs in Node.js on every server-component/action auth() call.
        // Returning null clears the session cookie immediately — demoted/suspended
        // users become guests on their next page render.
        if (process.env.NEXT_RUNTIME !== "edge") {
          try {
            const dbUser = await prisma.user.findUnique({
              where:  { id: token.id as string },
              select: { id: true, role: true, tokenVersion: true },
            });
            if (!dbUser) return null;
            // Revoke if tokenVersion has been incremented (demotion / suspension)
            if (dbUser.tokenVersion !== (token.tokenVersion as number ?? 0)) return null;
            // Keep role in token current (role changes take effect immediately)
            token.role = dbUser.role;
          } catch {
            // DB temporarily unreachable — trust the JWT rather than
            // locking everyone out.
          }
        }
      }
      return token;
    },

    // Expose role and id in the client-side session
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },

  events: {
    // ── createUser — fires when PrismaAdapter creates a brand-new user row ──
    // This is the most reliable hook for first-time OAuth users because it fires
    // AFTER the user is persisted to the DB but BEFORE signIn/jwt callbacks.
    // ensureWelcomeForUser is idempotent so duplicate calls from signIn/jwt are safe.
    async createUser({ user }) {
      if (user.id) {
        console.log(`[auth] events.createUser fired for userId: ${user.id}, email: ${user.email}`);
        await ensureWelcomeForUser(user.id).catch((err) => {
          console.error(`[auth] events.createUser welcome failed:`, err);
        });
      }
    },
  },
});
