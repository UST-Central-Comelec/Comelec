import type { Metadata } from "next";
import { FilingAccountPage } from "@/components/portal/filing-review/account-pages";

export const metadata: Metadata = { title: "Filing portal account" };

export default async function Page({ params }: PageProps<"/portal/polpar/registrations/accounts/[id]">) {
  return <FilingAccountPage area="polpar" id={(await params).id} />;
}
