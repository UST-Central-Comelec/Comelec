import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { InterviewPlanner } from "@/components/portal/interview-planner";
import { Notice } from "@/components/portal/notice";
import { requireAccess } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { getSlotsForPortal } from "@/lib/applications/interviews";
import { comelecUnits } from "@/lib/applications/options";
import { addInterviewSlots } from "@/lib/portal/interview-actions";
import { canManageEvent, canSeeInside, unitOfAccount } from "@/lib/events/access";
import { localUnit, unitKey } from "@/lib/periods/kinds";
import { comelecUnit } from "@/lib/events/options";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Interviews" };

export default async function PortalInterviewsPage({ searchParams }: PageProps<"/portal/recruitment/interviews">) {
  const { notice, day: dayParam, unit: asked } = await searchParams;
  const user = await requireAccess("recruitment/interviews");
  const other = typeof asked === "string" && comelecUnits.includes(asked) && canSeeInside(user, localUnit(asked)) ? localUnit(asked) : null;
  const unit = other ?? unitOfAccount(user);
  const key = unit ? unitKey(unit) : "";
  const readOnly = !unit || !canManageEvent(user, unit);
  const { value: slots, error: loadError } = unit ? await settle(getSlotsForPortal(key)) : { value: null, error: "Your account has no college set." };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const initialDay = typeof dayParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : undefined;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Recruitment</p>
          <TitleWithInfo info="Each Comelec unit adds its own interview times. Applicants only see the times for the unit they’re applying to, and a slot disappears from the form once it’s full or its time has passed.">Interviews</TitleWithInfo>
          {unit && <p className="portal-muted">{comelecUnit(unit.organizer, unit.college)}</p>}
        </div>
        <div className="portal-head-actions">
          <Link className="portal-button is-ghost" href="/apply/preview" target="_blank">View Mode <ArrowUpRight size={15} /></Link>
        </div>
      </header>
      <Notice notice={notice} />

      {loadError ? (
        <p className="portal-form-error" role="alert">
          Couldn’t load interview slots. Run <code>supabase/migrations/0039_local_central_division.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      ) : (
        <>
          <InterviewPlanner unit={key} unitOptions={user.affiliation !== "local" ? comelecUnits : undefined} key={`${key}:${initialDay ?? "calendar"}`} slots={slots ?? []} today={today} initialDay={initialDay} addAction={addInterviewSlots} readOnly={readOnly} />
        </>
      )}
    </main>
  );
}
