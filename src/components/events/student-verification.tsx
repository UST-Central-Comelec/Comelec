"use client";

import { useEffect, useState } from "react";

/** Verification runs in a popup so switching to Google preserves the form draft. */
export function StudentVerification({ eventId, target, onVerified }: { eventId: string; target: "rsvp-form" | "evaluate"; onVerified?: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(`event-verify:${eventId}:${target}`);
    channel.onmessage = ({ data }) => {
      if (data?.status === "ok" && typeof data.email === "string" && data.email.endsWith("@ust.edu.ph")) {
        setEmail(data.email);
        setError("");
        onVerified?.(data.email);
      } else {
        setError(data?.status === "not-ust" ? "Choose your @ust.edu.ph Google account." : "Verification did not complete. Please try again.");
      }
    };
    return () => channel.close();
  }, [eventId, target, onVerified]);
  const href = `/events/${eventId}/register/start?form=${target}`;
  return <div className="ev-student-verification">
    <p>{email ? `Verified UST account: ${email}` : "UST students, faculty and staff must verify their UST Google account. External respondents can continue without verification."}</p>
    <a className="ev-button is-ghost" href={href} target="_blank" rel="noopener" onClick={event => {
      if (!("BroadcastChannel" in window)) return;
      const popup = window.open(href, "event-student-verification", "popup,width=520,height=700");
      if (popup) event.preventDefault();
    }}>{email ? "Change verified account" : "Verify UST Google account"}</a>
    {error && <p className="ev-field-error" role="alert">{error}</p>}
  </div>;
}
