"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { fromLettersTracker, LETTERS_TRACKER_HREF } from "@/lib/portal/letters-return";

/** Back to Events, or to the Letters Tracker when the event was opened from there. */
export function EventBackLink() {
  const tracker = fromLettersTracker(useSearchParams().get("from"));
  return <Link className="portal-back" href={tracker ? LETTERS_TRACKER_HREF : "/portal/events"}>← {tracker ? "Letters Tracker" : "Events"}</Link>;
}
