import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import RoleForm from "../role-form";
import "../../casting-admin.css";

export const metadata: Metadata = { title: "Admin — Edit Casting Role" };

type Props = { params: Promise<{ id: string }> };

export default async function EditRolePage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const role = await prisma.castingRole.findUnique({ where: { id } });
  if (!role) notFound();

  return (
    <div className="ca-page">
      <div className="ca-header">
        <div className="ca-header-left">
          <Link href="/admin/casting/roles" className="ca-back-link">← Roles</Link>
          <h1 className="ca-title">Edit Role</h1>
          <p className="ca-subtitle">{role.title}</p>
        </div>
      </div>
      <RoleForm existing={role} />
    </div>
  );
}
