import type { Metadata } from "next";
import { MaintenanceSettings } from "@/components/portal/maintenance-settings";
import { requireExecutive, withPortalUser } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { getSiteSettings } from "@/lib/site-settings/store";

export const metadata: Metadata = { title: "Maintenance" };

export default async function PortalMaintenancePage({ searchParams }: PageProps<"/portal/maintenance">) {
  const { notice } = await searchParams;
  const [, { value: settings, error: loadError }] = await withPortalUser(settle(getSiteSettings()), requireExecutive);
  return <MaintenanceSettings settings={settings} loadError={loadError} notice={notice} />;
}
