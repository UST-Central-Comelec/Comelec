import type { Metadata } from "next";
import { FilingAccountPage } from "@/components/portal/filing-review/account-pages";

export const metadata: Metadata = { title: "Filing portal account" };

export default async function Page({ params }: PageProps<"/portal/candidacy/filings/accounts/[id]">) {
  return <FilingAccountPage area="candidacy" id={(await params).id} />;
}
