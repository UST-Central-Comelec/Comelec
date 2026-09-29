import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { InterviewPlanner } from "@/components/portal/interview-planner";
import { Notice } from "@/components/portal/notice";
import { withPortalUser } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { getSlotsForPortal } from "@/lib/applications/interviews";
import { divisions, type DivisionId } from "@/lib/applications/options";
import { addInterviewSlots } from "@/lib/portal/interview-actions";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Interviews" };

export default async function PortalInterviewsPage({ searchParams }: PageProps<"/portal/recruitment/interviews">) {
  const { notice, division: divisionParam, day: dayParam } = await searchParams;
  const division = typeof divisionParam === "string" && divisionParam in divisions ? (divisionParam as DivisionId) : undefined;

  const [, { value: slots, error: loadError }] = await withPortalUser(settle(getSlotsForPortal()));

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const initialDay = typeof dayParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : undefined;
  const shown = (slots ?? []).filter((item) => !division || item.division === division);

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Recruitment</p>
          <TitleWithInfo info="Each division adds its own interview times. Applicants only see the times for the division they’re applying to, and a slot disappears from the form once it’s full or its time has passed.">Interviews</TitleWithInfo>
        </div>
        <Link className="portal-button is-ghost" href="/apply/preview" target="_blank">View Mode <ArrowUpRight size={15} /></Link>
      </header>
      <Notice notice={notice} />

      {loadError ? (
        <p className="portal-form-error" role="alert">
          Couldn’t load interview slots. Run <code>supabase/migrations/0006_interview_slots.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      ) : (
        <>
          <nav className="portal-filters" aria-label="Filter by division">
            <Link href="/portal/recruitment/interviews" className={!division ? "is-active" : undefined}>All divisions</Link>
            {(Object.keys(divisions) as DivisionId[]).map((id) => (
              <Link key={id} href={`/portal/recruitment/interviews?division=${id}`} className={division === id ? "is-active" : undefined}>{divisions[id].label}</Link>
            ))}
          </nav>
          <InterviewPlanner key={`${division ?? "all"}-${initialDay ?? ""}`} slots={shown} today={today} division={division} initialDay={initialDay} addAction={addInterviewSlots} />
        </>
      )}
    </main>
  );
}
