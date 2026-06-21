import { auth } from "@/lib/auth";
import { verifyWelcomeToken } from "@/lib/welcome-token";
import { redirect } from "next/navigation";
import WelcomeLoginClient from "./welcome-login-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Signing you in — AIM Studio" };

export default async function WelcomeLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string; t?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const { uid, t } = await searchParams;

  if (!uid || !t || !(await verifyWelcomeToken(uid, t))) {
    redirect(
      "/login?error=" +
        encodeURIComponent("This link has expired or is invalid. Please sign in below.")
    );
  }

  return <WelcomeLoginClient uid={uid} token={t} />;
}
