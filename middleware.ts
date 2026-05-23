// Route protection middleware
// Runs on every request BEFORE the page renders

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role === "ADMIN";

  const path = nextUrl.pathname;

  // ── Admin routes: must be ADMIN ──────────────────────────
  if (path.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login?from=admin", nextUrl));
    }
    if (!isAdmin) {
      // Logged in but not admin — send to home
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // ── User dashboard: must be logged in ────────────────────
  if (path.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL(`/login?from=${path}`, nextUrl));
    }
    return NextResponse.next();
  }

  // ── Auth pages: redirect if already logged in ─────────────
  if (path === "/login" || path === "/register") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  // Run middleware on all routes except static files, images, and api/auth
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/auth).*)",
  ],
};
