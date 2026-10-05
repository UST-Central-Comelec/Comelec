import type { Metadata } from "next";
import { PeriodSettings } from "@/components/portal/period-settings";

export const metadata: Metadata = { title: "Filing of Candidacy settings" };

export default async function PortalCandidacySettingsPage({ searchParams }: PageProps<"/portal/candidacy/settings">) {
  const { notice, unit } = await searchParams;
  return <PeriodSettings kind="candidacy" notice={notice} unit={unit} />;
}
