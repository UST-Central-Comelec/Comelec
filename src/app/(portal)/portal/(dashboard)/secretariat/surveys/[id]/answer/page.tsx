import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/session";
import { getSurvey, hasSurveyResponse } from "@/lib/surveys/store";
import { SurveyAnswer } from "@/components/portal/survey-answer";
import { TitleWithInfo } from "@/components/portal/info-tip";
export const metadata: Metadata = { title: "Answer survey" };
export default async function AnswerSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("secretariat/surveys");
  const { id } = await params;
  const survey = await getSurvey(id, user);
  if (!survey) notFound();
  const answered = await hasSurveyResponse(survey, user.email);
  return <main className="portal-page"><header className="portal-page-head"><div><p className="portal-eyebrow">Secretariat</p><TitleWithInfo info="Your response is recorded under your signed-in portal account. You can submit once. Survey managers can review the answers.">{survey.title}</TitleWithInfo>{survey.description && <p className="portal-muted">{survey.description}</p>}</div></header><section className="portal-card">{survey.status !== "open" && !answered ? <p className="portal-empty">This survey is closed.</p> : <SurveyAnswer id={survey.id} title={survey.title} updatedAt={survey.updatedAt} definition={survey.definition} answered={answered} />}</section></main>;
}
