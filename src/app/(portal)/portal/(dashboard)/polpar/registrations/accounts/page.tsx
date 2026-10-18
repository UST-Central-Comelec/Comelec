import type { Metadata } from "next";
import { FilingAccountsPage } from "@/components/portal/filing-review/account-pages";

export const metadata: Metadata = { title: "Party accounts" };

export default function Page() {
  return <FilingAccountsPage area="polpar" />;
}
