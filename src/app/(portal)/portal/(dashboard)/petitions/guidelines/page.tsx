import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Petitions and Cases guidelines" };

export default async function PortalCaseGuidelinesPage() {
  await requireAccess("petitions/guidelines");
  return <ComingSoon section="Legals · Petitions and Cases" title="Guidelines">Guidelines for petitions and cases aren’t built yet.</ComingSoon>;
}
