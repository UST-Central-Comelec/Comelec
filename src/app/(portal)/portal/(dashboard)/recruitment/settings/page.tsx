import type { Metadata } from "next";
import { PeriodSettings } from "@/components/portal/period-settings";

export const metadata: Metadata = { title: "Recruitment settings" };

export default async function PortalRecruitmentSettingsPage({ searchParams }: PageProps<"/portal/recruitment/settings">) {
  const { notice, unit } = await searchParams;
  return <PeriodSettings kind="recruitment" notice={notice} unit={unit} />;
}
