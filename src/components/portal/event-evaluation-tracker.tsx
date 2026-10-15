"use client";

import { InfoTip } from "./info-tip";
import type { EventResponseCounts } from "@/lib/events/response-counts";

export function EventEvaluationTracker({ registered, counts }: { registered: number; counts: EventResponseCounts | null }) {
  if (!counts) return <div className="portal-event-capacity-tracker"><h3 className="portal-card-title">Evaluation tracker</h3><p className="portal-form-error" role="alert">Couldn’t load response totals. Reload the page and try again.</p></div>;
  const expected = registered + counts.rsvp;
  const remaining = Math.max(0, expected - counts.evaluation);
  const excess = Math.max(0, counts.evaluation - expected);
  const matched = expected > 0 && counts.evaluation === expected;
  const status = excess ? `${excess.toLocaleString()} above expected` : matched ? "Response totals match" : expected === 0 ? "Awaiting participants" : `${remaining.toLocaleString()} responses needed`;
  return <div className="portal-event-capacity-tracker portal-event-evaluation-tracker">
    <div className="portal-event-capacity-head"><h3>Evaluation tracker<InfoTip>The target is confirmed registrants plus all RSVP form responses. Waitlisted registrants don’t count. Each RSVP response counts once, including people who also registered. Anonymous evaluations count without matching or saving identities.</InfoTip></h3><span>{counts.evaluation.toLocaleString()} / {expected.toLocaleString()}</span></div>
    <dl className="portal-event-evaluation-totals">
      <div><dt>Registrants</dt><dd>{registered.toLocaleString()}</dd></div>
      <div><dt>RSVP responses</dt><dd>{counts.rsvp.toLocaleString()}</dd></div>
      <div><dt>Evaluations</dt><dd>{counts.evaluation.toLocaleString()}</dd></div>
    </dl>
    {expected > 0 && <progress value={Math.min(counts.evaluation, expected)} max={expected} aria-label="Evaluation response progress" />}
    <div className="portal-event-capacity-meta"><span className={`portal-tag${excess ? " is-warn" : matched ? " is-ok" : expected > 0 ? " is-gold" : ""}`}>{status}</span><span>{expected > 0 ? `${Math.round(counts.evaluation / expected * 100)}% received` : "No response target yet"}</span></div>
  </div>;
}
