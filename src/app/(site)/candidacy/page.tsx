import type { Metadata } from "next";
import { connection } from "next/server";
import { ApplicationNotOpen } from "@/components/application-not-open";
import { closingTime, formatClosing, isAccepting } from "@/lib/applications/period";
import { comelecUnit } from "@/lib/events/options";
import { listUnitPeriodsForSite } from "@/lib/periods/store";
import { combinePeriods, openUnits } from "@/lib/periods/summary";
import { comelecUnits } from "@/lib/applications/options";
import { sameUnit, unitFromParam } from "@/lib/periods/kinds";

export const metadata: Metadata = { title: "Filing of Candidacy" };

export default async function CandidacyPage({ searchParams }: PageProps<"/candidacy">) {
  // Every unit opens and closes its own from the portal (Filing of Candidacy → Settings), so read them on every request.
  await connection();
  const periods = await listUnitPeriodsForSite("candidacy");
  // The banner: open while any unit is.
  const period = combinePeriods(periods);
  const closesAt = closingTime(period);
  const closes = (iso: number | null) => (iso === null ? null : formatClosing(new Date(iso).toISOString()));
  // Sent here by an Apply button on the Events page: that unit comes first.
  const cameFor = unitFromParam((await searchParams).unit, comelecUnits);

  return (
    <ApplicationNotOpen
      title="Filing of Candidacy"
      eyebrow="Certificate of candidacy"
      status="Filing"
      description="The commission isn’t accepting certificates of candidacy right now. Watch the commission’s announcements for the filing period, requirements and schedule for the next elections."
      period={{ accepting: isAccepting(period), closesAt, closesLabel: closes(closesAt) }}
      units={openUnits(periods)
        .map((open) => ({ name: comelecUnit(open.unit.organizer, open.unit.college), closes: closes(closingTime(open)), picked: Boolean(cameFor && sameUnit(cameFor, open.unit)) }))
        .sort((a, b) => Number(b.picked) - Number(a.picked))}
    />
  );
}
