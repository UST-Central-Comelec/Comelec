"use client";

import { useState, type ReactNode } from "react";
import { UserPlus } from "lucide-react";
import type { AccessProfile } from "@/lib/access-requests/channel";
import { RequestAccessForm } from "./request-access-form";

/**
 * The sign-in card, which swaps to Request access in place. `accessStatus` is set when Google
 * verification finished in this window instead of a popup (?access=…), so the request opens straight away.
 */
export function LoginPanel({ brand, signIn, canRequest, verified, accessStatus }: { brand: ReactNode; signIn: ReactNode; canRequest: boolean; verified: AccessProfile | null; accessStatus?: string }) {
  const [requesting, setRequesting] = useState(Boolean(accessStatus) && canRequest);
  // The UST account verified for a request; kept here so going back to sign in doesn't lose it.
  const [profile, setProfile] = useState(verified);
  // Why the last verification in this window didn't go through; shown once.
  const [status, setStatus] = useState(accessStatus === "verified" ? undefined : accessStatus);

  return (
    <div className={`portal-login-card${requesting ? " is-request" : ""}`}>
      {brand}
      {requesting ? (
        <RequestAccessForm profile={profile} onProfileChange={setProfile} initialStatus={status} onBack={() => { setRequesting(false); setStatus(undefined); }} />
      ) : (
        <>
          {signIn}
          {canRequest && (
            <div className="portal-login-request">
              <p><span>Don’t have an account yet?</span></p>
              <button className="portal-button is-ghost is-block" type="button" onClick={() => setRequesting(true)}><UserPlus size={16} aria-hidden="true" /> Request access</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
