import type { Metadata } from "next";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { RecruitmentOnboarding } from "@/components/portal/recruitment-onboarding";
import { UnitSwitcher } from "@/components/portal/unit-switcher";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { requireAccess } from "@/lib/auth/session";
import { comelecUnits } from "@/lib/applications/options";
import { getOnboarding } from "@/lib/applications/onboarding-store";
import { canManageEvent, canSeeInside, unitOfAccount } from "@/lib/events/access";
import { localUnit, unitKey } from "@/lib/periods/kinds";
import { settle } from "@/lib/portal/settle";
import { ApplicantsTabs } from "@/components/portal/applicants-tabs";

export const metadata: Metadata = { title: "Applicant onboarding settings" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ unit?: string | string[]; notice?: string | string[] }> }) {
  const { unit: asked, notice } = await searchParams;
  const user = await requireAccess("recruitment/applications");
  const other = typeof asked === "string" && comelecUnits.includes(asked) && canSeeInside(user, localUnit(asked)) ? localUnit(asked) : null;
  const unit = other ?? unitOfAccount(user);
  const key = unit ? unitKey(unit) : "";
  const readOnly = !unit || !canManageEvent(user, unit);
  const { value: settings, error } = unit ? await settle(getOnboarding(key)) : { value: null, error: "Your account has no college set." };
  return <main className="portal-page">
    <header className="portal-page-head">
      <div>
        <p className="portal-eyebrow">Recruitment</p>
        <TitleWithInfo info="Set the onboarding links for your unit’s acceptance emails. Join the Commission always comes first, followed by Messenger and any additional buttons. The email format is shown under Email Sender’s automatic emails. Preview shows your current edits with sample applicant details.">Applicants</TitleWithInfo>
      </div>
      <div className="portal-head-actions">
        {user.affiliation !== "local" && <UnitSwitcher units={comelecUnits} value={key} />}
        {readOnly && <ViewOnlyTag />}
      </div>
    </header>
    <ApplicantsTabs current="onboarding" />
    <Notice notice={notice} />
    {settings ? <RecruitmentOnboarding key={`${key}:${JSON.stringify(settings)}`} settings={settings} unit={key} readOnly={readOnly} /> : <p className="portal-form-error" role="alert">Couldn’t load onboarding settings. Run <code>supabase/migrations/0073_recruitment_onboarding_buttons.sql</code> in the Supabase SQL Editor, then reload. ({error})</p>}
  </main>;
}
