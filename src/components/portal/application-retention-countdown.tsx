"use client";

import { useEffect, useState } from "react";
import { APPLICATION_RETENTION_DAYS } from "@/lib/applications/options";

export function ApplicationRetentionCountdown({ submittedAt }: { submittedAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  const expiresAt = Date.parse(submittedAt) + APPLICATION_RETENTION_DAYS * 86_400_000;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initialTick = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, []);

  if (!Number.isFinite(expiresAt)) return null;

  const secondsLeft = now === null ? null : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const countdown = secondsLeft === null ? "Calculating…" : secondsLeft === 0 ? "Deletion due" :
    `Auto-deletes in ${Math.floor(secondsLeft / 86_400)}d ${Math.floor(secondsLeft % 86_400 / 3600)}h ${Math.floor(secondsLeft % 3600 / 60)}m ${secondsLeft % 60}s`;

  return (
    <span className="portal-registrant-date portal-application-retention" title={`Record expires on ${new Date(expiresAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })} (PHT)`}>
      {countdown}
    </span>
  );
}
