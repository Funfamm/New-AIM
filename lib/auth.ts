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

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],

  callbacks: {
    // Block suspended/deactivated users from completing Google OAuth sign-in
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { status: true, email: true, id: true },
        });
        if (
          dbUser?.status === "SUSPENDED" ||
          dbUser?.status === "DEACTIVATED" ||
          dbUser?.status === "DELETED"
        ) return false;

        if (dbUser) {
          void prisma.user.update({
            where: { id: dbUser.id },
            data:  { lastLoginAt: new Date(), lastLoginProvider: "google" },
          }).catch(() => {});

          // Welcome flow — idempotent, only fires on first sign-in
          void ensureWelcomeForUser(dbUser.id).catch(() => {});

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
            if (isNew) {
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
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id! },
            select: { role: true },
          });
          token.role = dbUser?.role ?? "USER";
        } else {
          token.role = (user as { role?: string }).role ?? "USER";
        }
      } else if (token?.id) {
        // ── Subsequent requests — verify user still exists ───────
        // Skipped in Edge runtime (middleware) where Prisma is unavailable.
        // Runs in Node.js on every server-component/action auth() call:
        // returning null clears the session cookie so purged users
        // become guests on their next page render.
        if (process.env.NEXT_RUNTIME !== "edge") {
          try {
            const exists = await prisma.user.findUnique({
              where:  { id: token.id as string },
              select: { id: true },
            });
            if (!exists) return null;
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
});
