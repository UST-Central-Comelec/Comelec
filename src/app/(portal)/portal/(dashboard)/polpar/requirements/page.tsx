import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireCentral } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Political Party requirements" };

export default async function PortalPolParRequirementsPage() {
  await requireCentral();
  return <ComingSoon section="Political Party" title="Requirements">The requirements for political party applicants aren’t built yet.</ComingSoon>;
}
