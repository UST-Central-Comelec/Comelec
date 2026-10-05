import type { Metadata } from "next";
import { PeriodSettings } from "@/components/portal/period-settings";

export const metadata: Metadata = { title: "PolPaR settings" };

export default async function PortalPolParSettingsPage({ searchParams }: PageProps<"/portal/polpar/settings">) {
  const { notice, unit } = await searchParams;
  return <PeriodSettings kind="party-registration" notice={notice} unit={unit} />;
}
