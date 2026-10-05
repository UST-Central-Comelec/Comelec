import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Petitions & Cases settings" };

export default async function PortalPetitionSettingsPage() {
  await requireAccess("petitions/settings");
  return <ComingSoon section="Petitions & Cases" title="Settings">Settings for petitions and cases aren’t built yet.</ComingSoon>;
}
