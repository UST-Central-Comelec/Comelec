import type { Metadata } from "next";
import { ApplicationForm } from "@/components/application-form";
import { ApplyBanner } from "@/components/apply-banner";
import { withPortalUser } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { positions, type SlotCounts } from "@/lib/applications/options";
import { getInterviewsForApplyPage, getPeriodForApplyPage, getSlotsForApplyPage } from "@/lib/applications/apply-cache";
import { closingTime, formatClosing, isAccepting } from "@/lib/applications/period";

export const metadata: Metadata = { title: "Become a Commissioner (view mode)" };

/**
 * The Apply page in view mode, for commissioners checking it from the portal. It shows the live
 * period, slots and interview times, open or closed, but skips checks and verification and never submits.
 */
export default async function ApplyPreviewPage() {
  const [, [period, slots, interviews]] = await withPortalUser(Promise.all([getPeriodForApplyPage(), settle(getSlotsForApplyPage()), settle(getInterviewsForApplyPage())]));
  const closesAt = closingTime(period);

  return (
    <main className="apply-page">
      <ApplyBanner tabs={false} period={{ accepting: isAccepting(period), closesAt, closesLabel: closesAt === null ? null : formatClosing(period.closesAt!) }} />
      <ApplicationForm
        preview
        slots={slots.value ?? (Object.fromEntries(positions.map((position) => [position.id, 0])) as SlotCounts)}
        interviews={interviews.value ?? []}
        verified={null}
      />
    </main>
  );
}
