import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Accredited parties" };

export default async function PortalAccreditedPartiesPage() {
  await requireAccess("polpar/accredited-parties");
  return (
    <ComingSoon section="Political Party" title="Accredited parties">
      The accredited parties list isn’t available yet.
    </ComingSoon>
  );
}
