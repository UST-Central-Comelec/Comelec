import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Petitions and Cases setting" };

export default async function PortalPetitionSettingsPage() {
  await requireAccess("petitions/settings");
  return <ComingSoon section="Legals · Petitions and Cases" title="Setting">Settings for petitions and cases aren’t built yet.</ComingSoon>;
}
