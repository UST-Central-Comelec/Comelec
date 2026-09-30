import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ApplicationPeriodForm } from "@/components/portal/application-period-form";
import { Notice } from "@/components/portal/notice";
import { PeriodOverview } from "@/components/portal/period-overview";
import { requireCentral, withPortalUser } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { closingTime, formatClosing, isAccepting, isClosingSoon, type ApplicationPeriod } from "@/lib/applications/period";
import { getApplicationPeriod } from "@/lib/applications/period-store";
import { cancelClosing, updateApplicationPeriod } from "@/lib/portal/recruitment-actions";
import { TitleWithInfo } from "@/components/portal/info-tip";

export const metadata: Metadata = { title: "Recruitment settings" };

/** Where things stand, for the overview at the top of the page. */
function describePeriod(period: ApplicationPeriod) {
  const closes = closingTime(period);
  const when = closes === null ? "" : formatClosing(new Date(closes).toISOString());
  if (isClosingSoon(period)) return { state: "closing" as const, headline: "Closing applications", detail: `Closes ${when}, after the grace period. Anyone mid-application can still submit.`, closesAt: closes };
  if (period.mode === "closed") return { state: "closed" as const, headline: "Applications closed", detail: `Closed manually${closes === null ? "" : ` ${when}`}. The Apply page isn’t taking new applications.`, closesAt: null };
  if (closes === null) return { state: "open" as const, headline: "Accepting applications", detail: "Open with no closing date.", closesAt: null };
  return isAccepting(period)
    ? { state: "open" as const, headline: "Accepting applications", detail: `Closes ${when}`, closesAt: closes }
    : { state: "closed" as const, headline: "Applications closed", detail: `Closed automatically ${when}`, closesAt: null };
}

export default async function PortalRecruitmentSettingsPage({ searchParams }: PageProps<"/portal/recruitment/settings">) {
  const { notice } = await searchParams;
  const [, { value: period, error: loadError }] = await withPortalUser(settle(getApplicationPeriod()), requireCentral);
  // The seeded row says "system"; only name a person once someone has changed it.
  const updated = period?.updatedAt && period.updatedBy && period.updatedBy !== "system" ? `Last changed by ${period.updatedBy} · ${formatClosing(period.updatedAt)}` : null;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Recruitment</p>
          <TitleWithInfo info="Open or close commissioner applications for the whole recruitment period, on a schedule or right now.">Settings</TitleWithInfo>
        </div>
        <Link className="portal-button is-ghost" href="/apply/preview" target="_blank">View Mode <ArrowUpRight size={15} /></Link>
      </header>
      <Notice notice={notice} />

      {period ? (
        <>
          <PeriodOverview {...describePeriod(period)} updated={updated} cancelAction={cancelClosing} />
          <section className="portal-card portal-settings" aria-labelledby="application-period-title">
            <header className="portal-settings-head">
              <TitleWithInfo as="h2" className="portal-card-title" id="application-period-title" info="Controls whether the Apply page takes new applications, and the countdown it shows. Track application keeps working either way.">Application period</TitleWithInfo>
            </header>
            <ApplicationPeriodForm key={`${period.mode}-${period.closesAt}`} action={updateApplicationPeriod} mode={period.mode} closesAt={period.closesAt} />
          </section>
        </>
      ) : (
        <p className="portal-form-error" role="alert">
          Couldn’t load the application period. Run <code>supabase/migrations/0010_application_period.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      )}
    </main>
  );
}
