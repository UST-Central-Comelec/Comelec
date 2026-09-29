import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Notice } from "@/components/portal/notice";
import { RecruitmentForm } from "@/components/portal/recruitment-form";
import { requirePortalUser } from "@/lib/auth/session";
import { getSlots } from "@/lib/applications/slots";
import { updateRecruitmentSlots } from "@/lib/portal/recruitment-actions";

export const metadata: Metadata = { title: "Recruitment" };

export default async function PortalRecruitmentPage({ searchParams }: PageProps<"/portal/recruitment">) {
  await requirePortalUser();
  const { notice } = await searchParams;

  let slots: Awaited<ReturnType<typeof getSlots>> | null = null;
  let loadError: string | null = null;
  try {
    slots = await getSlots();
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Commissioner applications</p>
          <h1>Recruitment</h1>
          <p className="portal-muted">Set how many slots are open for each position. Applicants see these counts on the Apply page, and positions with 0 slots can’t be chosen.</p>
        </div>
        <Link className="portal-button is-ghost" href="/apply" target="_blank">View Apply page <ArrowUpRight size={15} /></Link>
      </header>
      <Notice notice={notice} />
      {slots ? (
        <RecruitmentForm action={updateRecruitmentSlots} slots={slots} />
      ) : (
        <p className="portal-form-error" role="alert">
          Couldn’t load recruitment settings. Run <code>supabase/migrations/0004_applications.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      )}
    </main>
  );
}
