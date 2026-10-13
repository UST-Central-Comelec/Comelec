import type { Metadata } from "next";
import { SurveysTable } from "@/components/portal/surveys-table";
import { requireAccess } from "@/lib/auth/session";
import { listSurveys } from "@/lib/surveys/store";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Surveys" };

export default async function PortalSurveysPage() {
  const user = await requireAccess("secretariat/surveys");
  const records = await settle(listSurveys(user));
  return <SurveysTable rows={records.value ?? []} readOnly={user.readOnly} loadError={records.error} />;
}
