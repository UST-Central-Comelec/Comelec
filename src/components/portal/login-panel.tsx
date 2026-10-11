"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { UserPlus } from "lucide-react";
import type { AccessProfile } from "@/lib/access-requests/channel";
import type { OnboardingDocument } from "@/lib/onboarding/documents";
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
 * (?access=…), so the request opens straight away. `join` is the reference code of an accepted
 * application, from the acceptance email's Join the Commission button: its details fill in the
 * profile, and the request is approved as soon as it's sent. `documents` are what Request access
 * asks them to agree to.
 */
export function LoginPanel({ signIn, note, canRequest, verified, accessStatus, requestAccess = false, join, documents }: { signIn: ReactNode; note?: ReactNode; canRequest: boolean; verified: AccessProfile | null; accessStatus?: string; requestAccess?: boolean; join: string | null; documents: OnboardingDocument[] }) {
  const [requesting, setRequesting] = useState((requestAccess || Boolean(accessStatus)) && canRequest);
  // The UST account verified for a request; kept here so going back to sign in doesn't lose it.
  const [profile, setProfile] = useState(verified);
  // Why the last verification in this window didn't go through; shown once.
  const [status, setStatus] = useState(accessStatus === "verified" ? undefined : accessStatus);

  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (requesting) {
      card.current?.style.removeProperty("--spot-x");
      card.current?.style.removeProperty("--spot-y");
    }
    const background = card.current?.closest(".portal-login")?.querySelector<HTMLElement>(".portal-login-aside");
    if (!background) return;
    background.inert = requesting;
    return () => { background.inert = false; };
  }, [requesting]);

  return (
    <div ref={card} className={`portal-login-card${requesting ? " is-request" : ""}`} data-enter style={{ "--enter": 3 } as CSSProperties} onPointerMove={requesting ? undefined : followPointer}>
      {requesting ? (
        <RequestAccessForm profile={profile} onProfileChange={setProfile} initialStatus={status} join={join} documents={documents} onBack={() => { setRequesting(false); setStatus(undefined); }} />
      ) : (
        <>
          {signIn}
          {canRequest && (
            <div className="portal-login-request">
              <p><span>Don’t have an account yet?</span></p>
              <button className="portal-button is-ghost is-beam is-block" type="button" onClick={() => setRequesting(true)}><UserPlus size={16} aria-hidden="true" /> Request access</button>
            </div>
          )}
          {note}
        </>
      )}
    </div>
  );
}
