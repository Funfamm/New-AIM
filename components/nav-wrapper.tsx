// Server component — fetches session + unread count and passes to Nav client component
import { auth } from "@/lib/auth";
import Nav from "@/components/nav";
import { getUnreadNotificationCount } from "@/lib/actions/notifications";
import "./nav.css";

export default async function NavWrapper() {
  const session = await auth();
  const unreadCount = session?.user?.id ? await getUnreadNotificationCount() : 0;
  return <Nav user={session?.user ?? null} unreadCount={unreadCount} />;
}
