import type { Metadata } from "next";
import { SurveyDetailPage } from "@/components/portal/survey-detail-page";

export const metadata: Metadata = { title: "Survey form editor" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SurveyDetailPage id={id} tab="form" />;
}
