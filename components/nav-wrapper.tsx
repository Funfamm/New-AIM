// Server component — fetches session, unread count, upcoming flag, and registration setting
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { withDbRetry } from "@/lib/db-retry";
import { captureError } from "@/lib/monitoring/capture-error";
import Nav from "@/components/nav";
import { getUnreadNotificationCount } from "@/lib/actions/notifications";
import "./nav.css";

// The nav renders on EVERY public page, so these two user-independent queries used to
// hit the DB on every page view — the uncached `work.count()` here (Promise.all index 1)
// was the recurring "Timed out fetching a new connection (connection limit: 5)" error
// across routes. Cache them in the Data Cache like the other public loaders.
const getHasUpcoming = unstable_cache(
  async (): Promise<boolean> => {
    // Only need existence — findFirst stops at the first row (cheaper than count()).
    const row = await prisma.work.findFirst({
      where: { status: { in: ["UPCOMING", "IN_PRODUCTION"] }, type: { not: "EPISODE" } },
      select: { id: true },
    });
    return row !== null;
  },
  ["nav-has-upcoming"],
  { tags: [CACHE_TAGS.works], revalidate: 300 },
);

const getAllowRegistrations = unstable_cache(
  async (): Promise<boolean> => {
    const settings = await prisma.adminSettings.findUnique({
      where: { id: "singleton" },
      select: { allowNewRegistrations: true },
    });
    return settings?.allowNewRegistrations ?? true;
  },
  ["nav-allow-registrations"],
  { tags: [CACHE_TAGS.publicSettings], revalidate: 300 },
);

// The nav lives in the layout — an unhandled throw here crashes EVERY page. Retry rides
// out a Neon cold start; the fallback degrades just the nav flag for one render.
// Takes a thunk (not a promise) so each retry re-RUNS the query instead of re-awaiting
// the same rejection. Catches live OUTSIDE the cached fns so a failure is never cached.
async function safeNav<T>(op: () => Promise<T>, fallback: T, loader: string): Promise<T> {
  try {
    return await withDbRetry(op);
  } catch (err) {
    captureError(err, { source: "SERVER", metadata: { loader, degraded: true } });
    return fallback;
  }
}

export default async function NavWrapper() {
  const session = await auth();

  const [unreadCount, hasUpcoming, allowRegistrations] = await Promise.all([
    session?.user?.id
      ? getUnreadNotificationCount().catch(() => 0) // per-user, stays live
      : Promise.resolve(0),
    safeNav(() => getHasUpcoming(), false, "nav.getHasUpcoming"),
    safeNav(() => getAllowRegistrations(), true, "nav.getAllowRegistrations"),
  ]);

  return (
    <Nav
      user={session?.user ?? null}
      unreadCount={unreadCount}
      hasUpcoming={hasUpcoming}
      allowRegistrations={allowRegistrations}
    />
  );
}
