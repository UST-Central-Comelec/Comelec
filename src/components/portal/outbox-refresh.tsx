"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Reloads the Outbox's figures every few seconds while an email is going out, so its progress shows without a refresh. */
export function OutboxRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
