import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Request" };

export default async function PortalRequestPage() {
  await requireAccess("request");
  return <ComingSoon section="Portal" title="Request">Requests aren’t available yet.</ComingSoon>;
}
