import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireCentral } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Petitions & Cases submissions" };

export default async function PortalPetitionSubmissionsPage() {
  await requireCentral();
  return <ComingSoon section="Petitions & Cases" title="Submissions">Petition and case submissions aren’t built yet.</ComingSoon>;
}
