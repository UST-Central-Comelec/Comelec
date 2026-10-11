import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Case docket" };

export default async function PortalCaseDocketPage() {
  await requireAccess("petitions/case-docket");
  return <ComingSoon section="Legals · Petitions and Cases" title="Case Docket">Petition and case submissions aren’t built yet.</ComingSoon>;
}
