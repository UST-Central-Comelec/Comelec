"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLoginConfigured } from "@/lib/auth/session";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/config";
import { createAuthClient } from "@/lib/supabase/server";

async function siteOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signInWithGoogle() {
  if (!isLoginConfigured()) redirect("/portal/login?error=not-configured");

  const { data, error } = await (await createAuthClient()).auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/portal/auth/callback`,
      // `hd` only pre-selects UST accounts in Google's picker; the domain is enforced after sign-in.
      queryParams: { hd: ALLOWED_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/portal/login?error=failed");
  redirect(data.url);
}

export async function logout() {
  await (await createAuthClient()).auth.signOut();
  redirect("/portal/login");
}
