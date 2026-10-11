import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Surveys" };

export default async function PortalSurveysPage() {
  await requireAccess("secretariat/surveys");
  return <ComingSoon section="Secretariat" title="Surveys">No surveys have been added yet.</ComingSoon>;
}
