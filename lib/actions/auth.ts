"use server";
// Server Actions for register and login
// Called directly from form components — no API route needed

import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

// ── Register ──────────────────────────────────────────────────
export async function registerUser(formData: FormData) {
  const name = formData.get("name") as string;
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;

  // Basic validation
  if (!email || !password || password.length < 8) {
    redirect("/register?error=" + encodeURIComponent("Please provide a valid email and a password of at least 8 characters."));
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/register?error=" + encodeURIComponent("An account with this email already exists."));
  }

  // Hash password — 12 rounds is secure without being slow
  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name: name?.trim() || null,
      email,
      password: hashed,
      role: "USER",
    },
  });

  // Auto-login after register
  await signIn("credentials", { email, password, redirectTo: "/" });
}

// ── Login ─────────────────────────────────────────────────────
export async function loginUser(formData: FormData) {
  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;
  const from = (formData.get("from") as string) || "/";

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: from,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      const fromParam = from !== "/" ? `&from=${encodeURIComponent(from)}` : "";
      redirect("/login?error=" + encodeURIComponent("Invalid email or password.") + fromParam);
    }
    throw err; // re-throw redirect, etc.
  }
}

// ── Logout ────────────────────────────────────────────────────
export async function logoutUser() {
  await signOut({ redirectTo: "/" });
}
