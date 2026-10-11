import type { Metadata } from "next";
import { RateLimitScreen } from "./rate-limit-screen";

export const metadata: Metadata = { title: "Too many requests" };

// What src/proxy.ts shows in place of a portal page when one address has made too many requests.
// The browser's address bar still shows the page that was asked for, so "Try again" just reloads it.
// `retry` is how many seconds are left in the limiter's window.
export const dynamic = "force-dynamic";

export default async function TooManyRequestsPage({ searchParams }: PageProps<"/too-many-requests">) {
  const { retry } = await searchParams;
  const seconds = Number(Array.isArray(retry) ? retry[0] : retry);
  return <RateLimitScreen retryAfter={Number.isFinite(seconds) ? Math.min(Math.max(Math.ceil(seconds), 0), 3600) : 60} />;
}
