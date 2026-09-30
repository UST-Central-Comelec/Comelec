import type { Metadata } from "next";
import { FilingSettings } from "@/components/portal/filing-settings";

export const metadata: Metadata = { title: "Filing of Candidacy settings" };

export default async function PortalCandidacySettingsPage({ searchParams }: PageProps<"/portal/candidacy/settings">) {
  const { notice } = await searchParams;
  return <FilingSettings kind="candidacy" notice={notice} />;
}
