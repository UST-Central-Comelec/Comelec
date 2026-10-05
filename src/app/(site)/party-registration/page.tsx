import type { Metadata } from "next";
import { connection } from "next/server";
import { ApplicationNotOpen } from "@/components/application-not-open";
import { closingTime, formatClosing, isAccepting } from "@/lib/applications/period";
import { comelecUnit } from "@/lib/events/options";
import { listUnitPeriodsForSite } from "@/lib/periods/store";
import { combinePeriods, openUnits } from "@/lib/periods/summary";
import { comelecUnits } from "@/lib/applications/options";
import { sameUnit, unitFromParam } from "@/lib/periods/kinds";
import { PartyRegistrationForm } from "@/components/polpar/registration-form";
import { PageBanner } from "@/components/page-banner";
import "../banner-page.css";
import "./party-registration.css";

export const metadata: Metadata = { title: "Political Party Registration" };

export default async function PartyRegistrationPage({ searchParams }: PageProps<"/party-registration">) {
  // Every unit opens and closes its own from the portal (PolPaR → Settings), so read them on every request.
  await connection();
  const periods = await listUnitPeriodsForSite("party-registration");
  // The banner: open while any unit is.
  const period = combinePeriods(periods);
  const closesAt = closingTime(period);
  const closes = (iso: number | null) => (iso === null ? null : formatClosing(new Date(iso).toISOString()));
  // Sent here by an Apply button on the Events page: that unit comes first.
  const cameFor = unitFromParam((await searchParams).unit, comelecUnits);
  const acceptingUnits = openUnits(periods);

  if (acceptingUnits.length) {
    const units = acceptingUnits.map((open) => ({ value: open.unit.college ?? "central", label: comelecUnit(open.unit.organizer, open.unit.college), closes: closes(closingTime(open)) }));
    const selected = acceptingUnits.find((open) => cameFor && sameUnit(cameFor, open.unit));
    return <main className="bp">
      <PageBanner eyebrow="Party accreditation · POLPAR" title={<>Register your <em>political party.</em></>} lede="File your petition, complete your party’s records, and submit the supporting documents for Commission review." readings={[{ label: "Registration", value: "Open" }, { label: "Application", value: "Forms 01–07" }]} seed={701} />
      <div className="bp-wrap bp-body"><PartyRegistrationForm units={units} initialUnit={selected ? selected.unit.college ?? "central" : units[0].value} /></div>
    </main>;
  }

  return (
    <ApplicationNotOpen
      title="Political Party Registration"
      eyebrow="Party accreditation"
      status="Registration"
      description="The commission isn’t accepting political party registrations right now. Watch the commission’s announcements for the registration period, requirements and schedule for the next elections."
      period={{ accepting: isAccepting(period), closesAt, closesLabel: closes(closesAt) }}
      units={openUnits(periods)
        .map((open) => ({ name: comelecUnit(open.unit.organizer, open.unit.college), closes: closes(closingTime(open)), picked: Boolean(cameFor && sameUnit(cameFor, open.unit)) }))
        .sort((a, b) => Number(b.picked) - Number(a.picked))}
    />
  );
}
