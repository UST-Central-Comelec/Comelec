import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireExecutive } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Logs" };

export default async function PortalLogsPage() {
  await requireExecutive();
  return <ComingSoon section="Administrative" title="Logs">Portal activity logs aren’t built yet.</ComingSoon>;
}
