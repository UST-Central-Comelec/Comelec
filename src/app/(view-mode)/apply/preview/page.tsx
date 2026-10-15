import type { Metadata } from "next";
import { ApplicationForm } from "@/components/application-form";
import { ApplyBanner } from "@/components/apply-banner";
import { withPortalUser } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { getInterviewsForApplyPage, getUnitSlotsForApplyPage } from "@/lib/applications/apply-cache";

export const metadata: Metadata = { title: "Become a Commissioner (view mode)" };

/**
 * The Apply page in view mode, for commissioners checking it from the portal. It shows the live
 * slots and interview times, open or closed, but skips checks and verification and never submits.
 */
export default async function ApplyPreviewPage() {
  const [, [slots, interviews]] = await withPortalUser(Promise.all([settle(getUnitSlotsForApplyPage()), settle(getInterviewsForApplyPage())]));

  return (
    <main className="apply-page">
      <ApplyBanner />
      <ApplicationForm
        preview
        slots={slots.value?.[""] ?? {}}
        unitSlots={slots.value ?? {}}
        interviews={interviews.value ?? []}
        verified={null}
      />
    </main>
  );
}
