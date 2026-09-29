import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { HelpDialog } from "@/components/portal/help-dialog";
import { Notice } from "@/components/portal/notice";
import { RecruitmentForm } from "@/components/portal/recruitment-form";
import { withPortalUser } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { getSlots } from "@/lib/applications/slots";
import { updateRecruitmentSlots } from "@/lib/portal/recruitment-actions";

export const metadata: Metadata = { title: "Recruitment slots" };

export default async function PortalRecruitmentSlotsPage({ searchParams }: PageProps<"/portal/recruitment/slots">) {
  const { notice } = await searchParams;

  const [, { value: slots, error: loadError }] = await withPortalUser(settle(getSlots()));

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Recruitment</p>
          <h1>Slots</h1>
          <HelpDialog label="How slots work" title="How slots work">
            <ul>
              <li><strong>Set the number of open slots</strong> for each position. Applicants see these counts on the Apply page.</li>
              <li><strong>Accepting an applicant takes one slot</strong> from their position automatically. Rejecting them, or moving them back to pending, gives it back.</li>
              <li><strong>0 closes the position.</strong> Applicants can’t choose it on the Apply page until you add a slot again.</li>
              <li><strong>A position with no slots left can’t accept more applicants.</strong> Add a slot here first, then accept.</li>
              <li><strong>Saving only changes the counts you edited</strong>, so an applicant accepted while you had this page open isn’t undone.</li>
            </ul>
          </HelpDialog>
        </div>
        <Link className="portal-button is-ghost" href="/apply/preview" target="_blank">View Mode <ArrowUpRight size={15} /></Link>
      </header>
      <Notice notice={notice} />
      {slots ? (
        // Keyed on the counts so the inputs reset when they change (after a save or an acceptance).
        <RecruitmentForm key={JSON.stringify(slots)} action={updateRecruitmentSlots} slots={slots} />
      ) : (
        <p className="portal-form-error" role="alert">
          Couldn’t load recruitment slots. Run <code>supabase/migrations/0004_applications.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      )}
    </main>
  );
}
