import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/session";
import { getSurvey, surveyResponses } from "@/lib/surveys/store";
import { stampFor } from "@/lib/data/edit-guard";
import { surveySchema } from "@/lib/surveys/types";
import { SurveyWorkspace } from "@/components/portal/survey-workspace";
export const metadata: Metadata = { title: "Survey details" };
export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("secretariat/surveys");
  const { id } = await params;
  const survey = await getSurvey(id, user);
  if (!survey) notFound();
  const responses = await surveyResponses(survey);
  return <SurveyWorkspace key={survey.updatedAt} initial={survey} readOnly={user.readOnly} responses={responses} guard={user.readOnly ? undefined : { stamp: stampFor(survey.updatedAt, surveySchema.parse(survey)), record: `secretariat_surveys/${survey.id}` }} />;
}
