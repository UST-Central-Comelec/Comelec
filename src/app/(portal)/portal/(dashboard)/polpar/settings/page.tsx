import type { Metadata } from "next";
import { FilingSettings } from "@/components/portal/filing-settings";

export const metadata: Metadata = { title: "PolPaR settings" };

export default async function PortalPolParSettingsPage({ searchParams }: PageProps<"/portal/polpar/settings">) {
  const { notice } = await searchParams;
  return <FilingSettings kind="party-registration" notice={notice} />;
}
