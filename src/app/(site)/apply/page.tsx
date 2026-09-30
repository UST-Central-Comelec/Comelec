import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ApplicationForm } from "@/components/application-form";
import { positions, type SlotCounts } from "@/lib/applications/options";
import { getInterviewsForApplyPage, getPeriodForApplyPage, getSlotsForApplyPage } from "@/lib/applications/apply-cache";
import { isAccepting } from "@/lib/applications/period";
import { readPass } from "@/lib/applications/verification";
import type { InterviewSlot } from "@/lib/applications/interview-format";

export const metadata: Metadata = { title: "Become a Commissioner" };

async function loadSlots(): Promise<SlotCounts> {
  try {
    return await getSlotsForApplyPage();
  } catch (error) {
    // Most likely the recruitment tables haven't been created yet. Show every position as full
    // rather than breaking the page.
    console.error(error);
    return Object.fromEntries(positions.map((position) => [position.id, 0]));
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
  // Closed from the portal (Recruitment → Settings), or its scheduled closing time has passed.
  if (!isAccepting(await getPeriodForApplyPage())) return <ApplicationsClosed />;

  const [slots, interviews, pass, { verify }] = await Promise.all([loadSlots(), loadInterviews(), readPass(), searchParams]);
  const verified = pass ? { email: pass.email, firstName: pass.firstName, lastName: pass.lastName } : null;

  return <ApplicationForm slots={slots} interviews={interviews} verified={verified} verifyStatus={typeof verify === "string" ? verify : undefined} />;
}

function ApplicationsClosed() {
  return (
    <div className="apply-body apply-closed" role="status">
      <div className="apply-body-head">
        <span>Commissioner applications</span>
        <h2>Applications are closed</h2>
        <p>The commission isn’t accepting new applications right now. Watch the commission’s announcements for the next recruitment period. Already applied? You can still check on your application.</p>
      </div>
      <footer className="apply-nav">
        <Link className="apply-back" href="/"><ArrowLeft size={15} /> Back to home</Link>
        <Link className="button-primary" href="/apply/track">Track application <ArrowRight size={15} /></Link>
      </footer>
    </div>
  );
}
