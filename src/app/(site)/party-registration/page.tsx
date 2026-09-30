import type { Metadata } from "next";
import { connection } from "next/server";
import { ApplicationNotOpen } from "@/components/application-not-open";
import { closingTime, formatClosing, isAccepting } from "@/lib/applications/period";
import { getFilingPeriodForSite } from "@/lib/filings/period-store";

export const metadata: Metadata = { title: "Political Party Registration" };

export default async function PartyRegistrationPage() {
  // Opened and closed from the portal (PolPaR → Settings), so read it on every request.
  await connection();
  const period = await getFilingPeriodForSite("party-registration");
  const closesAt = closingTime(period);

  return (
    <ApplicationNotOpen
      title="Political Party Registration"
      eyebrow="Party accreditation"
      status="Registration"
      description="The commission isn’t accepting political party registrations right now. Watch the commission’s announcements for the registration period, requirements and schedule for the next elections."
      period={{ accepting: isAccepting(period), closesAt, closesLabel: closesAt === null ? null : formatClosing(new Date(closesAt).toISOString()) }}
    />
  );
}
