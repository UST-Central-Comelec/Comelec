import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Calendar" };

export default async function PortalCalendarPage() {
  await requireAccess("apps/calendar");
  return <ComingSoon section="Apps" title="Calendar">The commission calendar isn’t built yet.</ComingSoon>;
}
