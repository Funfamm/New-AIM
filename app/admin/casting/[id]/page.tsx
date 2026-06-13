import { adminGetApplication, adminUpdateApplicationStatus, adminAddNote, adminRetriggerReview } from "@/lib/actions/casting";
import { requireAdmin } from "@/lib/auth-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ApplicationDetailClient from "./application-detail-client";
import "../casting-admin.css";

export const metadata: Metadata = { title: "Admin — Applicant Detail" };

type Props = { params: Promise<{ id: string }> };

export default async function AdminApplicationDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const app = await adminGetApplication(id);
  if (!app) notFound();

  return (
    <div className="ca-page">
      <div className="ca-header">
        <div className="ca-header-left">
          <Link href="/admin/casting" className="ca-back-link">← Applications</Link>
          <h1 className="ca-title">{app.name}</h1>
          <p className="ca-subtitle">{app.role.title}</p>
        </div>
      </div>

      <ApplicationDetailClient app={app} />
    </div>
  );
}
