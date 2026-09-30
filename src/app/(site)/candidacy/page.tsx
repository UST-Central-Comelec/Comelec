import type { Metadata } from "next";
import { connection } from "next/server";
import { ApplicationNotOpen } from "@/components/application-not-open";
import { closingTime, formatClosing, isAccepting } from "@/lib/applications/period";
import { getFilingPeriodForSite } from "@/lib/filings/period-store";

export const metadata: Metadata = { title: "Filing of Candidacy" };

export default async function CandidacyPage() {
  // Opened and closed from the portal (Filing of Candidacy → Settings), so read it on every request.
  await connection();
  const period = await getFilingPeriodForSite("candidacy");
  const closesAt = closingTime(period);

  return (
    <ApplicationNotOpen
      title="Filing of Candidacy"
      eyebrow="Certificate of candidacy"
      status="Filing"
      description="The commission isn’t accepting certificates of candidacy right now. Watch the commission’s announcements for the filing period, requirements and schedule for the next elections."
      period={{ accepting: isAccepting(period), closesAt, closesLabel: closesAt === null ? null : formatClosing(new Date(closesAt).toISOString()) }}
    />
  );
}
