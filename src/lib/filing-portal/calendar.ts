import "server-only";

import { closingTime, isAccepting, isUpcoming } from "@/lib/applications/period";
import { activityKinds, activityStatusLabel } from "@/lib/candidacy/campaign";
import { listActivities } from "@/lib/candidacy/campaign-store";
import { formatEventTimes, manilaToday } from "@/lib/events/format";
import { comelecUnit } from "@/lib/events/options";
import { getEventsForSite } from "@/lib/events/queries";
import { applyHref, periodKinds, unitKey } from "@/lib/periods/kinds";
import { listUnitPeriodsForSite } from "@/lib/periods/store";
import { unitName } from "@/lib/party-portal/types";
import { createAdminClient } from "@/lib/supabase/server";
import type { FilingCalendarEntry, FilingCalendarHighlight } from "@/components/filing-portal/calendar";
import { requestKinds, requestStatusLabel, manilaParts, topicLabel } from "./services";
import { listAccountRequests } from "./services-store";
import { unitsOf } from "./service-units";
import type { FilingAccount } from "./session";

// What the filing portal's Calendar shows an account: for its units (the Central Comelec, and its
// college's, its party's and its candidacy's), Political Party Registration and Filing of Candidacy
// while they're open or scheduled, the units' published events, and the no-campaign days, holidays
// and university events on the Secretariat calendar; and its own campaign schedule and requests.
// Each part that can't be read is left out rather than taking the page down.

const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
const closeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const timeRange = (start: string, end: string) => `${timeFormat.format(new Date(start))} – ${timeFormat.format(new Date(end))}`;
const quietly = async <T,>(load: Promise<T>, fallback: T): Promise<T> => {
  try { return await load; } catch (error) { console.error("Filing calendar:", error instanceof Error ? error.message : error); return fallback; }
};

async function highlightsFor(colleges: string[]): Promise<FilingCalendarHighlight[]> {
  const { data, error } = await createAdminClient().from("calendar_highlights").select("id, start_date, end_date, kind, label, college").in("kind", ["moratorium", "holiday", "university"]).limit(2000);
  if (error) return [];
  return (data ?? [])
    .filter((row) => row.college === null || colleges.includes(row.college as string))
    .map((row) => ({ id: row.id as string, start: row.start_date as string, end: row.end_date as string, kind: row.kind as FilingCalendarHighlight["kind"], label: (row.label as string | null) || (row.kind === "moratorium" ? "No-campaign day" : row.kind === "holiday" ? "Holiday" : "University event"), unit: unitName((row.college as string | null) ?? "") }));
}

export async function filingCalendar(filing: FilingAccount): Promise<{ today: string; entries: FilingCalendarEntry[]; highlights: FilingCalendarHighlight[] }> {
  const now = Date.now();
  const today = manilaToday(now);
  const units = await unitsOf(filing);
  const [periods, events, highlights, activities, requests] = await Promise.all([
    listUnitPeriodsForSite(),
    quietly(getEventsForSite(), []),
    quietly(highlightsFor(units.filter(Boolean)), []),
    filing.candidacy ? quietly(listActivities(filing.candidacy.id), []) : Promise.resolve([]),
    quietly(listAccountRequests(filing.account.id), []),
  ]);

  const entries: FilingCalendarEntry[] = [];

  for (const period of periods) {
    if (period.kind === "recruitment" || !units.includes(unitKey(period.unit))) continue;
    const upcoming = isUpcoming(period, now);
    if (!upcoming && !isAccepting(period, now)) continue;
    const closes = closingTime(period);
    const start = upcoming && period.opensAt ? manilaParts(period.opensAt)[0] : period.opensAt && Date.parse(period.opensAt) <= now ? manilaParts(period.opensAt)[0] : today;
    entries.push({
      id: `${period.kind}-${unitKey(period.unit) || "central"}`,
      kind: period.kind,
      name: periodKinds[period.kind].title,
      unit: comelecUnit(period.unit.organizer, period.unit.college),
      start,
      end: closes ? manilaParts(closes)[0] : start,
      time: closes ? `Until ${closeFormat.format(closes)}` : "No closing date set",
      status: upcoming ? `Opens ${closeFormat.format(Date.parse(period.opensAt!))}` : "Open now",
      state: upcoming ? "waiting" : "open",
      href: applyHref(period.kind, period.unit),
      external: true,
    });
  }

  for (const event of events) {
    const college = event.organizer === "central" ? "" : event.college ?? "";
    if (!units.includes(college)) continue;
    const cancelled = event.registrationStatus === "cancelled";
    entries.push({
      id: `event-${event.id}`, kind: "event", name: event.name, unit: comelecUnit(event.organizer, event.college), start: event.eventDate, end: event.endDate < event.eventDate ? event.eventDate : event.endDate,
      time: formatEventTimes(event), status: cancelled ? "Cancelled" : event.endDate < today ? "Ended" : "Event", state: cancelled || event.endDate < today ? "off" : "open", cancelled, href: `/events/${event.id}`, external: true,
    });
  }

  for (const activity of activities) {
    if (activity.status === "declined") continue;
    const [date] = manilaParts(activity.startsAt);
    entries.push({
      id: `activity-${activity.id}`, kind: "campaign", name: activity.title, unit: `${activityKinds[activity.kind].label} · ${activity.venue}`, start: date, end: date,
      time: timeRange(activity.startsAt, activity.endsAt), status: activityStatusLabel[activity.status], state: activity.status === "approved" ? "open" : activity.status === "cancelled" ? "off" : "waiting",
      cancelled: activity.status === "cancelled", href: "/filing/candidacy/schedule",
    });
  }

  for (const request of requests) {
    if (request.status === "declined" || request.status === "cancelled") continue;
    const start = request.confirmedStart ?? request.startsAt;
    const end = request.confirmedEnd ?? request.endsAt;
    const [date] = manilaParts(start);
    entries.push({
      id: `request-${request.id}`, kind: "service", name: request.kind === "consultation" ? `Consultation: ${request.subject}` : `Commissioner at ${request.subject}`, unit: `${unitName(request.college)} · ${topicLabel(request)}`,
      start: date, end: date, time: `${timeRange(start, end)}${request.status === "confirmed" && request.location ? ` · ${request.location}` : ""}`, status: request.status === "requested" ? "Asked for, not confirmed yet" : requestStatusLabel[request.status],
      state: request.status === "confirmed" ? "open" : request.status === "requested" ? "waiting" : "off", href: requestKinds[request.kind].href,
    });
  }

  entries.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  return { today, entries, highlights };
}
