import type { Metadata } from "next";
import { requireExecutive } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Error test" };

// Fails on purpose, outside the portal's shell, to show the full-screen error ((portal)/error.tsx,
// the same screen as global-error.tsx). Opened from Maintenance → Fallback screens.

export default async function FullScreenErrorTestPage(): Promise<never> {
  await requireExecutive();
  throw new Error("Test error, opened from Maintenance → Fallback screens. Nothing is wrong.");
}
