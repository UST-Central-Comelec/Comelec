import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireCentral } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tickets" };

export default async function PortalTicketsPage() {
  await requireCentral();
  return <ComingSoon section="Apps" title="Tickets">Tickets aren’t built yet.</ComingSoon>;
}
