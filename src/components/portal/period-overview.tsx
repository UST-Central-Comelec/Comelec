"use client";

import { Check, Clock3, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/** Ticks every second once mounted; null on the server so the markup matches. */
export function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return now;
}

/** `short` shows minutes and seconds only, for the few minutes of a closing grace period. */
function Countdown({ closesAt, short }: { closesAt: number; short?: boolean }) {
  const router = useRouter();
  const now = useNow();
  const left = now === null ? null : Math.max(0, closesAt - now);
  const ended = left === 0;

  // When time runs out, reload so the status flips to closed.
  useEffect(() => {
    if (!ended) return;
    const timer = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(timer);
  }, [ended, router]);

  const seconds = left === null ? null : Math.floor(left / 1000);
  const all: Array<[string, number | null]> = [
    ["days", seconds === null ? null : Math.floor(seconds / 86400)],
    ["hrs", seconds === null ? null : Math.floor(seconds / 3600) % 24],
    ["min", seconds === null ? null : Math.floor(seconds / 60) % 60],
    ["sec", seconds === null ? null : seconds % 60],
  ];
  const units = short ? all.slice(2) : all;

  return (
    <ol className="period-countdown" aria-label="Time left">
      {units.map(([unit, value]) => (
        <li key={unit}><strong>{value === null ? "--" : String(value).padStart(2, "0")}</strong><small>{unit}</small></li>
      ))}
    </ol>
  );
}

const stateIcons = { open: Check, closing: Clock3, closed: Minus };
const stateLabels = { open: "Live", closing: "Closing", closed: "Closed" };

/**
 * The status at the top of Recruitment → Settings (and PolPaR's and Filing of Candidacy's): open, closing (a manual close still in its
 * grace period, which can be cancelled), or closed; when it closes; and who last changed it.
 */
export function PeriodOverview({
  state,
  headline,
  detail,
  closesAt,
  updated,
  cancelAction,
  label = "Application period status",
}: {
  state: "open" | "closing" | "closed";
  headline: string;
  detail: string;
  closesAt: number | null;
  updated: string | null;
  /** Left out for an Adviser or Admin, who only reads: there's then nothing to cancel with. */
  cancelAction?: () => Promise<void>;
  label?: string;
}) {
  const StatusIcon = stateIcons[state];
  return (
    <section className={`period-overview is-${state}`} aria-label={label}>
      <div className="period-overview-main">
        <span className="period-overview-state"><StatusIcon size={14} strokeWidth={1.8} aria-hidden="true" />{stateLabels[state]}</span>
        <h2>{headline}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {state !== "closed" && closesAt !== null && (
        <div className="period-overview-side">
          <Countdown closesAt={closesAt} short={state === "closing"} />
          {state === "closing" && cancelAction && (
            <form action={cancelAction}>
              <CancelButton />
            </form>
          )}
        </div>
      )}
      {updated && <p className="period-overview-meta">{updated}</p>}
    </section>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  return <button className="portal-button is-ghost" type="submit" disabled={pending}>{pending ? "Cancelling…" : "Cancel closing"}</button>;
}
