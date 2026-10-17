import type { Metadata } from "next";
import { connection } from "next/server";
import { ApplicationNotOpen } from "@/components/application-not-open";
import { ApplyBanner } from "@/components/apply-banner";
import { FilingSignUp } from "@/components/filing-portal/sign-up";
import { closingTime, formatClosing, isAccepting } from "@/lib/applications/period";
import { comelecUnits } from "@/lib/applications/options";
import { loadElectivePositions } from "@/lib/candidacy/positions-store";
import { comelecUnit } from "@/lib/events/options";
import { findAccountByEmail } from "@/lib/filing-portal/accounts";
import { readFilingPass } from "@/lib/filing-portal/verification";
import { listJoinableParties } from "@/lib/party-portal/store";
import { sameUnit, unitFromParam } from "@/lib/periods/kinds";
import { listUnitPeriodsForSite } from "@/lib/periods/store";
import { combinePeriods, openUnits } from "@/lib/periods/summary";
import { ensureReferenceData } from "@/lib/reference/store";

export const metadata: Metadata = { title: "Filing of Candidacy" };

export default async function CandidacyPage({ searchParams }: PageProps<"/candidacy">) {
  await ensureReferenceData();
  // Every unit opens and closes its own from the portal (Filing of Candidacy → Settings), so read them on every request.
  await connection();
  const periods = await listUnitPeriodsForSite("candidacy");
  // The banner: open while any unit is.
  const period = combinePeriods(periods);
  const closesAt = closingTime(period);
  const closes = (iso: number | null) => (iso === null ? null : formatClosing(new Date(iso).toISOString()));
  // Sent here by an Apply button on the Events page: that unit comes first. `verify` is how Google
  // sign-in went, when it ran in this window instead of a popup.
  const { unit, verify } = await searchParams;
  const cameFor = unitFromParam(unit, comelecUnits);
  const acceptingUnits = openUnits(periods);

  if (acceptingUnits.length) {
    const units = acceptingUnits.map((open) => ({ value: open.unit.college ?? "central", label: comelecUnit(open.unit.organizer, open.unit.college), closes: closes(closingTime(open)) }));
    const selected = acceptingUnits.find((open) => cameFor && sameUnit(cameFor, open.unit));
    // Candidates sign up in the filing portal here, in the same form as Political Party Registration.
    // Each unit's elective positions come from Administrative → Database; the accredited parties to
    // run under, and a saved profile, come once they've verified.
    const pass = await readFilingPass();
    const [{ positions }, account, parties] = await Promise.all([
      loadElectivePositions(),
      pass ? findAccountByEmail(pass.email).catch(() => null) : null,
      pass ? listJoinableParties("accredited").catch(() => []) : [],
    ]);
    return <main className="apply-page">
      <ApplyBanner title={<>Filing of <span>candidacy</span></>} />
      <FilingSignUp
        purpose="candidacy"
        units={units}
        initialUnit={selected ? selected.unit.college ?? "central" : units.length === 1 ? units[0].value : ""}
        verified={pass && { email: pass.email, firstName: pass.firstName, lastName: pass.lastName }}
        profile={account}
        parties={parties}
        positions={Object.fromEntries(Object.entries(positions).map(([key, list]) => [key, list.map((position) => position.name)]))}
        verifyStatus={typeof verify === "string" ? verify : undefined}
      />
    </main>;
  }

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
      action={{ href: "/filing/login", label: "Sign in to the filing portal" }}
    />
  );
}
