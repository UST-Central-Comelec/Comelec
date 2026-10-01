import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Error test", robots: { index: false, follow: false } };

// Fails on purpose, to show the site's error page (../error.tsx). Opened from the portal's
// Maintenance → Fallback screens; to anyone but a signed-in executive it doesn't exist.

export default async function SiteErrorTestPage(): Promise<never> {
  const user = await getPortalUser();
  if (user?.role !== "executive") notFound();
  throw new Error("Test error, opened from Maintenance → Fallback screens. Nothing is wrong.");
}
