import { connection } from "next/server";
import { ApplyBanner } from "@/components/apply-banner";
import { getPeriodForApplyPage } from "@/lib/applications/apply-cache";
import { closingTime, formatClosing, isAccepting } from "@/lib/applications/period";

/** Shared by Apply now (/apply) and Track application (/apply/track). */
export default async function ApplyLayout({ children }: LayoutProps<"/apply">) {
  // The application period is changed from the portal, so read it on every request.
  await connection();
  const period = await getPeriodForApplyPage();
  const closesAt = closingTime(period);

  return (
    <main className="apply-page">
      <ApplyBanner period={{ accepting: isAccepting(period), closesAt, closesLabel: closesAt === null ? null : formatClosing(new Date(closesAt).toISOString()) }} />
      {children}
    </main>
  );
}
