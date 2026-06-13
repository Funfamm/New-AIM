import { requireAdmin } from "@/lib/auth-guard";
import Link from "next/link";
import type { Metadata } from "next";
import RoleForm from "../role-form";
import "../../casting-admin.css";

export const metadata: Metadata = { title: "Admin — New Casting Role" };

export default async function NewRolePage() {
  await requireAdmin();
  return (
    <div className="ca-page">
      <div className="ca-header">
        <div className="ca-header-left">
          <Link href="/admin/casting/roles" className="ca-back-link">← Roles</Link>
          <h1 className="ca-title">New Role</h1>
        </div>
      </div>
      <RoleForm />
    </div>
  );
}
