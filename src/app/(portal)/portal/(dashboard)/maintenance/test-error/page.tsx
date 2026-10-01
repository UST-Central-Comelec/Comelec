import type { Metadata } from "next";
import { requireExecutive } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Error test" };

// Fails on purpose, to show the portal's error page (../../error.tsx). Opened from Maintenance →
// Fallback screens.

export default async function PortalErrorTestPage(): Promise<never> {
  await requireExecutive();
  throw new Error("Test error, opened from Maintenance → Fallback screens. Nothing is wrong.");
}
