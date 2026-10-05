import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ApplicationForm } from "@/components/application-form";
import { colleges, type UnitSlotCounts } from "@/lib/applications/options";
import { FACEBOOK_PAGE } from "@/lib/content";
import { unitFromParam } from "@/lib/periods/kinds";
import { getInterviewsForApplyPage, getOpenBodiesForApplyPage, getPeriodForApplyPage, getUnitSlotsForApplyPage } from "@/lib/applications/apply-cache";
import { isAccepting } from "@/lib/applications/period";
import { getCommissionAccounts } from "@/lib/applications/account-lookup";
import { readPass } from "@/lib/applications/verification";
import type { InterviewSlot } from "@/lib/applications/interview-format";

export const metadata: Metadata = { title: "Become a Commissioner" };

async function loadSlots(): Promise<UnitSlotCounts> {
  try {
    return await getUnitSlotsForApplyPage();
  } catch (error) {
    // Most likely the recruitment tables haven't been created yet. Show every position as full
    // rather than breaking the page.
    console.error(error);
    return {};
  }
}

async function loadInterviews(): Promise<InterviewSlot[]> {
  try {
    return await getInterviewsForApplyPage();
  } catch (error) {
    // Most likely 0006_interview_slots.sql hasn't been run yet. The form then skips the interview.
    console.error(error);
    return [];
  }
}

export default async function ApplyPage({ searchParams }: PageProps<"/apply">) {
  // Slot counts change from the portal, so read them on every request.
  await connection();
  // Every unit opens and closes its own recruitment (Recruitment → Settings). The form is here while
  // any unit is recruiting, and offers only the units that are.
  if (!isAccepting(await getPeriodForApplyPage())) return <ApplicationsClosed />;

  const [slots, interviews, bodies, pass, { verify, unit }] = await Promise.all([loadSlots(), loadInterviews(), getOpenBodiesForApplyPage(), readPass(), searchParams]);
  // Sent here by an Apply button on the Events page: the form starts on that unit (a college's Local Comelec, or the Central Comelec).
  const cameFor = unitFromParam(unit, colleges);
  const preset = cameFor ? { body: cameFor.organizer, college: cameFor.college } : undefined;
  const verified = pass ? { email: pass.email, firstName: pass.firstName, lastName: pass.lastName, commissionAccounts: await getCommissionAccounts(pass.email) } : null;

  return <ApplicationForm slots={slots[""] ?? {}} unitSlots={slots} interviews={interviews} bodies={bodies} preset={preset} verified={verified} verifyStatus={typeof verify === "string" ? verify : undefined} />;
}

function ApplicationsClosed() {
  return (
    <div className="apply-body apply-closed" role="status">
      <div className="apply-body-head">
        <span>Commissioner applications</span>
        <h2>Applications are closed</h2>
        <p>The commission isn’t accepting new applications right now. Watch the commission’s announcements for the next recruitment period. Already applied? You can still check on your application.</p>
        <p>For the next recruitment period and the latest updates, follow the <a href={FACEBOOK_PAGE} target="_blank" rel="noreferrer">Central Comelec’s Facebook page</a>.</p>
      </div>
      <footer className="apply-nav">
        <Link className="apply-back" href="/"><ArrowLeft size={15} /> Back to home</Link>
        <Link className="button-primary" href="/apply/track">Track application <ArrowRight size={15} /></Link>
      </footer>
    </div>
  );
}
