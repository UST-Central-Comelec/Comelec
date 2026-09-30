import { redirect } from "next/navigation";

/** Filing of Candidacy opens on its Filings tab. */
export default function PortalCandidacyPage() {
  redirect("/portal/candidacy/filings");
}
