import type { Metadata } from "next";
import { FilingSubmissions } from "@/components/portal/filing-settings";

export const metadata: Metadata = { title: "Party registrations" };

export default function PortalPartyRegistrationsPage() {
  return <FilingSubmissions kind="party-registration" />;
}
