import type { Metadata } from "next";
import { FallbackScreen } from "@/components/fallback/fallback-screen";
import { getSiteSettingsForSite } from "@/lib/site-settings/store";

export const metadata: Metadata = { title: "Under maintenance" };

// What src/proxy.ts shows in place of the website while it's under maintenance. The message can be
// set in the portal (Maintenance); if it can't be read, the usual wording is used.
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const { maintenanceMessage } = await getSiteSettingsForSite();
  return (
    <FallbackScreen
      code="503"
      eyebrow="Website under maintenance"
      working
      title={<>Back in orbit <em>shortly.</em></>}
      actions={[{ label: "Check again", primary: true, href: "/" }, { label: "Email the commission", href: "mailto:comelec@ust.edu.ph" }]}
    >
      {maintenanceMessage ?? "The UST Central Comelec website is offline for a short while as we work on it. Nothing has been lost: applications and filings already submitted are safe."} Please check back soon, and for anything urgent, write to <a href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</a>.
    </FallbackScreen>
  );
}
