import { getPublicCastingRole, getUserApplicationForRole } from "@/lib/actions/casting";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import ApplyForm from "./apply-form";
import "../../casting.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const role = await getPublicCastingRole(slug);
  return { title: role ? `Apply — ${role.title} — AIM Studio` : "Apply" };
}

export default async function ApplyPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?redirect=${encodeURIComponent(`/casting/${slug}/apply`)}`);
  }

  const role = await getPublicCastingRole(slug);
  if (!role || !role.isOpen) notFound();

  const existing = await getUserApplicationForRole(role.id);
  if (existing) {
    redirect(`/casting/applications/track/${existing.trackingToken}`);
  }

  return <ApplyForm role={role} />;
}
