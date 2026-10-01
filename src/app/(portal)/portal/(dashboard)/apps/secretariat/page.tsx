import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireCentral } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Secretariat" };

export default async function PortalSecretariatPage() {
  await requireCentral();
  return <ComingSoon section="Apps" title="Secretariat">The Secretariat’s workspace isn’t built yet.</ComingSoon>;
}
