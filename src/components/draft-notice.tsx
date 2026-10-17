"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Clock, Info } from "lucide-react";
import { SESSION_MINUTES, type FormDraft } from "./use-form-draft";
import "./draft-notice.css";

/** The last stretch of a session, when the countdown warns. */
const WARN_MS = 5 * 60 * 1000;

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser has lost its connection. Assumed online until the page is running. */
function useOffline() {
  return useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
}

/** The time now, ticking each second while there's a session to count down. */
function useNow(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [running]);
  return now;
}

function clock(time: number) {
  return new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(time));
}

function countdown(ms: number) {
  // Never above the full session, for the moment before the first tick.
  const seconds = Math.min(SESSION_MINUTES * 60, Math.max(0, Math.ceil(ms / 1000)));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** When time's up: a dialog that can't be dismissed, with the one way on, starting again. */
export function DraftExpired({ draft, actionClassName }: { draft: FormDraft; actionClassName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (draft.expired && !dialog.current?.open) dialog.current?.showModal();
  }, [draft.expired]);
  if (!draft.expired) return null;
  return (
    <dialog ref={dialog} className="draft-expired" aria-labelledby="draft-expired-title" onCancel={(event) => event.preventDefault()}>
      <Clock size={22} aria-hidden="true" />
      <h2 id="draft-expired-title">Your session has ended.</h2>
      <p>Each session is held for {SESSION_MINUTES} minutes, and this one ran out, so the answers on this page were cleared. Start again to fill in the form.</p>
      <div className="draft-expired-actions">
        <button type="button" className={actionClassName} autoFocus onClick={() => window.location.reload()}>Start again</button>
      </div>
    </dialog>
  );
}

/**
 * The session in a page's title strip (the Commissioner Application's banner): the countdown at the
 * right, in the banner's own countdown style, with a short note under it when there's news.
 */
export function DraftStrip({ draft }: { draft: FormDraft }) {
  const offline = useOffline();
  const now = useNow(draft.endsAt !== null && !draft.expired);
  if (draft.endsAt === null || draft.expired) return null;
  const left = Math.min(SESSION_MINUTES * 60 * 1000, Math.max(0, draft.endsAt - now));
  const seconds = Math.ceil(left / 1000);
  const warn = left <= WARN_MS;
  const note = offline
    ? "You’re offline. Answers are kept on this device."
    : warn
      ? "Almost out of time. Send it before the session ends."
      : draft.restoredAt
        ? `We brought back the answers you left at ${clock(draft.restoredAt)}.`
        : null;
  return (
    <div className={`draft-strip${warn ? " is-warn" : ""}`}>
      <div className="apply-countdown" role="timer" aria-label={`Session time left: ${Math.ceil(left / 60000)} minutes, until ${clock(draft.endsAt)}`} title={`Session ends at ${clock(draft.endsAt)}`}>
        <span className="apply-countdown-label">Time left</span>
        <ol aria-hidden="true">
          <li><strong>{String(Math.floor(seconds / 60)).padStart(2, "0")}</strong><small>min</small></li>
          <li><strong>{String(seconds % 60).padStart(2, "0")}</strong><small>sec</small></li>
        </ol>
      </div>
      {note && (
        <p className="draft-strip-note" role="status">
          {offline || warn ? <AlertTriangle size={13} aria-hidden="true" /> : <Info size={13} aria-hidden="true" />}
          <span>{note}</span>
          {draft.restoredAt && !offline && !warn && <button type="button" onClick={draft.startOver}>Start over</button>}
        </p>
      )}
    </div>
  );
}

/**
 * Sits at the top of a form that keeps a draft (use-form-draft.ts). Like booking a ticket, it counts
 * down the session's hour; says when answers were brought back, with a way to start over; says
 * answers are kept while the connection is down; and when time's up, a dialog asks them to start
 * again. `note` adds what couldn't be kept, like attached files. `buttonClassName` is the family's
 * secondary button, `actionClassName` its main one.
 */
export function DraftNotice({ draft, buttonClassName, actionClassName, note }: { draft: FormDraft; buttonClassName: string; actionClassName: string; note?: string }) {
  const offline = useOffline();
  const now = useNow(draft.endsAt !== null && !draft.expired);

  if (draft.expired) return <DraftExpired draft={draft} actionClassName={actionClassName} />;

  if (draft.endsAt === null) return null;
  const left = draft.endsAt - now;
  const warn = left <= WARN_MS;
  const Icon = offline || warn ? AlertTriangle : draft.restoredAt ? Info : Clock;
  const message = offline
    ? "You’re offline. Your answers are kept on this device, so you can send them once you’re back online."
    : warn
      ? "Almost out of time. Send the form before the session ends, or your answers will be cleared."
      : draft.restoredAt
        ? `We brought back the answers you left at ${clock(draft.restoredAt)}.${note ? ` ${note}` : ""}`
        : `Your answers are kept on this device until the session ends at ${clock(draft.endsAt)}.`;

  return (
    <div className={`draft-notice${warn ? " is-warn" : ""}`}>
      <Icon size={15} aria-hidden="true" />
      <p role="status">{message}</p>
      <span className="draft-notice-timer" role="timer" aria-label={`Session time left: ${Math.ceil(Math.max(0, left) / 60000)} minutes`}>
        <span aria-hidden="true">{countdown(left)}</span>
      </span>
      {draft.restoredAt && <button type="button" className={buttonClassName} onClick={draft.startOver}>Start over</button>}
    </div>
  );
}
