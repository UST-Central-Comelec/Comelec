import { AccountDetailsModal } from "@/components/portal/account-details-modal";
import { AccountDetailsPage } from "@/components/portal/account-details-page";
import { accountReviewReturnHref } from "@/lib/portal/account-review-return";

export default async function AccountModalPage({ params, searchParams }: PageProps<"/portal/accounts/[id]/review">) {
  const [{ id }, { notice, from }] = await Promise.all([params, searchParams]);
  const returnHref = accountReviewReturnHref(from);
  return <AccountDetailsModal returnHref={typeof from === "string" ? returnHref : undefined}><AccountDetailsPage id={id} notice={notice} modal returnHref={returnHref} /></AccountDetailsModal>;
}
