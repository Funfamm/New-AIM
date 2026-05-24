import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin-sidebar";
import "./admin-layout.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">{children}</main>

    </div>
  );
}
