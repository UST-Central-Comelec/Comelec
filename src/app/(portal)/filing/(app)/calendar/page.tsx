import type { Metadata } from "next";
import { FilingCalendar } from "@/components/filing-portal/calendar";
import { filingCalendar } from "@/lib/filing-portal/calendar";
import { requireFilingAccount } from "@/lib/filing-portal/session";

export const metadata: Metadata = { title: "Calendar" };

/** Calendar: party registration and candidacy filing, the units' events, no-campaign days, and the account's own campaign and requests. */
export default async function FilingCalendarPage() {
  const filing = await requireFilingAccount();
  const { today, entries, highlights } = await filingCalendar(filing);
  return (
    <main className="portal-page is-wide cal-page">
      <FilingCalendar today={today} entries={entries} highlights={highlights} />
    </main>
  );
}
