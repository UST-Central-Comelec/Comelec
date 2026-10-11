"use client";

import { useEffect, useState } from "react";
import { FallbackScreen } from "@/components/fallback/fallback-screen";

/** Counts down the limiter's window, then lets the visitor reload the page they asked for. */
export function RateLimitScreen({ retryAfter }: { retryAfter: number }) {
  const [left, setLeft] = useState(retryAfter);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const waiting = left > 0;
  const wait = left >= 60 ? `${Math.ceil(left / 60)} min` : `${left}s`;

  return (
    <FallbackScreen
      code="429"
      eyebrow="Too many requests"
      working={waiting}
      title={<>Hold steady for <em>a moment.</em></>}
      actions={[
        { label: waiting ? `Try again in ${wait}` : "Try again", primary: true, disabled: waiting, onClick: () => window.location.reload() },
        // The public site isn't rate-limited, so it's somewhere to go while waiting.
        { label: "Go to the main site", href: "/" },
      ]}
    >
      The portal received more requests from your network than it allows in a short time, so it’s pausing them briefly. Nothing you’ve saved is affected. {waiting ? "You can try again once the timer runs out." : "You can try again now."} On a shared network like the campus Wi-Fi, others’ activity counts too; if this keeps happening, let us know at <a href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</a>.
    </FallbackScreen>
  );
}
