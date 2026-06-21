import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "@/components/admin-sidebar";
import "./admin-layout.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/");

  // Live count of errors still needing attention — drives the sidebar "Errors" badge,
  // so it reflects what's actually unresolved and clears as errors are resolved/ignored.
  const [unreadNotifications, openErrorCount] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.user.id, type: "SYSTEM", read: false },
    }),
    prisma.errorLog
      .count({ where: { status: { in: ["NEW", "ACKNOWLEDGED"] } } })
      .catch(() => 0),
  ]);

  return (
    <div className="admin-shell">
      <AdminSidebar unreadNotifications={unreadNotifications} openErrorCount={openErrorCount} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
