import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { accountReviewReturnHref } from "@/lib/portal/account-review-return";

export const metadata: Metadata = { title: "Manage account" };

export default async function ManageAccountPage({ params, searchParams }: PageProps<"/portal/accounts/[id]">) {
  const [{ id }, { notice, from }] = await Promise.all([params, searchParams]);
  const query = new URLSearchParams();
  if (typeof notice === "string") query.set("notice", notice);
  if (typeof from === "string") query.set("from", accountReviewReturnHref(from));
  redirect(`/portal/accounts/${id}/review${query.size ? `?${query}` : ""}`);
}
