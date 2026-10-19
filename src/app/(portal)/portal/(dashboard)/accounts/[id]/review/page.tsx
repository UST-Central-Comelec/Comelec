import type { Metadata } from "next";
import { AccountDetailsModal } from "@/components/portal/account-details-modal";
import { AccountDetailsPage } from "@/components/portal/account-details-page";
import PortalAccountsPage from "../../page";
import AccountApprovalsPage from "../../approvals/page";
import { accountReviewReturnHref } from "@/lib/portal/account-review-return";

export const metadata: Metadata = { title: "Account details" };

/** A full navigation or reload must open the same modal as an intercepted row click. */
export default async function AccountReviewPage({ params, searchParams }: PageProps<"/portal/accounts/[id]/review">) {
  const [{ id }, { notice, from }] = await Promise.all([params, searchParams]);
  const returnHref = accountReviewReturnHref(from);
  const source = new URL(returnHref, "https://portal.invalid");
  const listParams = { params: Promise.resolve({}), searchParams: Promise.resolve(Object.fromEntries(source.searchParams)) };
  return <>
    {source.pathname === "/portal/accounts/approvals" ? <AccountApprovalsPage {...listParams} /> : <PortalAccountsPage {...listParams} />}
    <AccountDetailsModal returnHref={returnHref}>
      <AccountDetailsPage id={id} notice={notice} modal returnHref={returnHref} />
    </AccountDetailsModal>
  </>;
}
