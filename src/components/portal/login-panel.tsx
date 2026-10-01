"use client";

import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { UserPlus } from "lucide-react";
import type { AccessProfile } from "@/lib/access-requests/channel";
import { RequestAccessForm } from "./request-access-form";

/** Lights the card under the mouse, through --spot-x/--spot-y. */
function followPointer(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== "mouse") return;
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  card.style.setProperty("--spot-x", `${Math.round(event.clientX - box.left)}px`);
  card.style.setProperty("--spot-y", `${Math.round(event.clientY - box.top)}px`);
}

/**
 * The sign-in card, which swaps to Request access in place. `note` is the line under the sign-in
 * buttons. `accessStatus` is set when Google verification finished in this window instead of a popup
 * (?access=…), so the request opens straight away.
 */
export function LoginPanel({ signIn, note, canRequest, verified, accessStatus }: { signIn: ReactNode; note?: ReactNode; canRequest: boolean; verified: AccessProfile | null; accessStatus?: string }) {
  const [requesting, setRequesting] = useState(Boolean(accessStatus) && canRequest);
  // The UST account verified for a request; kept here so going back to sign in doesn't lose it.
  const [profile, setProfile] = useState(verified);
  // Why the last verification in this window didn't go through; shown once.
  const [status, setStatus] = useState(accessStatus === "verified" ? undefined : accessStatus);

  // The card's height at sign-in, held while requesting so the card doesn't change size. Only the long About you form outgrows it.
  const card = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  return (
    <div ref={card} className={`portal-login-card${requesting ? " is-request" : ""}`} data-enter style={{ "--enter": 3, minHeight: requesting ? height : undefined } as CSSProperties} onPointerMove={followPointer}>
      {requesting ? (
        <RequestAccessForm profile={profile} onProfileChange={setProfile} initialStatus={status} onBack={() => { setRequesting(false); setStatus(undefined); }} />
      ) : (
        <>
          {signIn}
          {canRequest && (
            <div className="portal-login-request">
              <p><span>Don’t have an account yet?</span></p>
              <button className="portal-button is-ghost is-beam is-block" type="button" onClick={() => { setHeight(card.current?.offsetHeight); setRequesting(true); }}><UserPlus size={16} aria-hidden="true" /> Request access</button>
            </div>
          )}
          {note}
        </>
      )}
    </div>
  );
}
