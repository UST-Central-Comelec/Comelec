import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Manual" };

export default async function PortalManualPage() {
  await requireAccess("apps/manual");
  return <ComingSoon section="Apps" title="Manual">No manual content has been added yet.</ComingSoon>;
}
