"use client";

import type { CommissionEvent } from "@/lib/events/options";
import { formatClosing } from "@/lib/applications/period";
import { PeriodOverview, useNow } from "./period-overview";

type OverviewEvent = Pick<CommissionEvent, "registrationStatus" | "eventDate" | "endDate" | "startsTime" | "endsTime" | "updatedAt" | "updatedBy">;

/** Registration is closed manually; this countdown describes the event's schedule. */
export function EventOverview({ event }: { event: OverviewEvent }) {
  const now = useNow();
  const starts = Date.parse(`${event.eventDate}T${event.startsTime.slice(0, 5)}:00+08:00`);
  const ends = Date.parse(`${event.endDate || event.eventDate}T${event.endsTime.slice(0, 5)}:00+08:00`);
  const started = now !== null && now >= starts;
  const ended = now !== null && now >= ends;
  const accepts = event.registrationStatus === "open" || event.registrationStatus === "waitlist";
  const cancelled = event.registrationStatus === "cancelled";
  const target = ended || cancelled ? null : started ? ends : starts;
  const schedule = Number.isFinite(target) && target !== null
    ? `${started ? "Event ends" : "Event starts"} ${formatClosing(new Date(target).toISOString())}`
    : ended && !cancelled ? `Event ended ${formatClosing(new Date(ends).toISOString())}` : "";
  const headlines = {
    open: "Accepting registrations",
    waitlist: "Accepting waitlist entries",
    closed: "Registration closed",
    cancelled: "Event cancelled",
    rescheduled: "Event rescheduled",
  };
  const updated = event.updatedBy && event.updatedBy !== "system" && Number.isFinite(Date.parse(event.updatedAt))
    ? `Last changed by ${event.updatedBy} · ${formatClosing(event.updatedAt)}` : null;
  return <div className="portal-event-overview">
    <PeriodOverview
      label="Event registration status"
      state={accepts ? "open" : "closed"}
      headline={headlines[event.registrationStatus]}
      detail={[schedule, accepts ? "Registration closes manually in Deployment." : cancelled ? "Registration is unavailable." : ""].filter(Boolean).join(". ")}
      closesAt={accepts && target !== null && Number.isFinite(target) ? target : null}
      updated={updated}
    />
  </div>;
}
