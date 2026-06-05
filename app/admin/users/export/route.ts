import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      password: true,
      accounts: { select: { provider: true } },
    },
  });

  function esc(v: string) {
    return `"${v.replace(/"/g, '""')}"`;
  }

  const header = ["ID", "Name", "Email", "Role", "Status", "Login Method", "Joined", "Last Login"].join(",");

  const rows = users.map((u) => {
    const providers = u.accounts.map((a) => a.provider);
    const hasGoogle = providers.includes("google");
    const method =
      hasGoogle && u.password ? "multi" : hasGoogle ? "google" : "email";
    return [
      esc(u.id),
      esc(u.name ?? ""),
      esc(u.email),
      u.role,
      u.status,
      method,
      u.createdAt.toISOString().split("T")[0],
      u.lastLoginAt ? u.lastLoginAt.toISOString().split("T")[0] : "",
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `users-${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
