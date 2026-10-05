import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Logs" };

export default async function PortalLogsPage() {
  await requireAccess("logs");
  return <ComingSoon section="Administrative" title="Logs">Portal activity logs aren’t built yet.</ComingSoon>;
}
