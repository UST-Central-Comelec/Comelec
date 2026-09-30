import type { Metadata } from "next";
import { FilingSubmissions } from "@/components/portal/filing-settings";

export const metadata: Metadata = { title: "Candidacy filings" };

export default function PortalCandidacyFilingsPage() {
  return <FilingSubmissions kind="candidacy" />;
}
