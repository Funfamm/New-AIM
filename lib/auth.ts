// Auth.js v5 (NextAuth) configuration
// Strategy: JWT (required for credentials provider)
// Providers: Credentials + Google OAuth

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    // allowDangerousEmailAccountLinking: when a Google email matches an existing
    // credentials user, the adapter links the Google account to that user instead
    // of blocking. Google verifies email ownership, so this is safe.
    Google({ allowDangerousEmailAccountLinking: true }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    // Attach role and id to the JWT token
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        if (account?.type === "oauth") {
          // OAuth sign-in: role is not on Auth.js user type, fetch from DB
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id! },
            select: { role: true },
          });
          token.role = dbUser?.role ?? "USER";
        } else {
          // Credentials sign-in: role comes from authorize() return value
          token.role = (user as { role?: string }).role ?? "USER";
        }
      }
      return token;
    },

    // Expose role and id in the client-side session
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
