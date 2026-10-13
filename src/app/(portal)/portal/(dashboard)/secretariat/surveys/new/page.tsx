import type { Metadata } from "next";
import { requireEditor } from "@/lib/auth/session";
import { SurveyWorkspace } from "@/components/portal/survey-workspace";
export const metadata: Metadata = { title: "Add survey" };
export default async function NewSurveyPage() {
  await requireEditor("secretariat/surveys");
  return <SurveyWorkspace initial={null} readOnly={false} />;
}
