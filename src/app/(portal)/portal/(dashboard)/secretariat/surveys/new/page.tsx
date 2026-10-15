import type { Metadata } from "next";
import Link from "next/link";
import { requireEditor } from "@/lib/auth/session";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { SurveyEditor } from "@/components/portal/survey-editor";
import { ActingAs } from "@/components/portal/event-tags";
import { unitOfAccount } from "@/lib/events/access";

export const metadata: Metadata = { title: "Add survey" };

export default async function NewSurveyPage() {
  const user = await requireEditor("secretariat/surveys");
  const unit = unitOfAccount(user);
  return <main className="portal-page portal-survey-page">
    <header className="portal-page-head"><div><Link className="portal-back" href="/portal/secretariat/surveys">← Surveys</Link><TitleWithInfo info="Add the survey as a draft while you build the questions, then set it to Open in Details to collect responses. Each member answers once, and the questions lock after the first response so all answers stay comparable.">Add survey</TitleWithInfo></div></header>
    {unit ? <><ActingAs unit={unit}>You’re adding this survey as</ActingAs><SurveyEditor initial={null} section="new" /></> : <p className="portal-form-error" role="alert">Your account has no college set. Ask the Central Executive Board to set it under Accounts before adding a survey.</p>}
  </main>;
}
