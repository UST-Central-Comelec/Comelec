import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Filing of Candidacy requirements" };

export default async function PortalCandidacyRequirementsPage() {
  await requireAccess("candidacy/requirements");
  return <ComingSoon section="Filing of Candidacy" title="Requirements">The requirements for candidacy applicants aren’t built yet.</ComingSoon>;
}
