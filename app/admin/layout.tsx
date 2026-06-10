import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdminRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "@/components/admin-sidebar";
import "./admin-layout.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) redirect("/");

  const unreadNotifications = await prisma.notification.count({
    where: {
      userId: session.user.id,
      type: "SYSTEM",
      read: false,
    },
  });

  return (
    <div className="admin-shell">
      <AdminSidebar unreadNotifications={unreadNotifications} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
