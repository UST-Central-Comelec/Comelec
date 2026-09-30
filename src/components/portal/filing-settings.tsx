import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ApplicationPeriodForm } from "@/components/portal/application-period-form";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { PeriodOverview } from "@/components/portal/period-overview";
import { isLocal, requireCentral, requirePortalUser, withPortalUser } from "@/lib/auth/session";
import { closingTime, formatClosing, isAccepting, isClosingSoon, type ApplicationPeriod } from "@/lib/applications/period";
import { filingKinds, type FilingKind } from "@/lib/filings/kinds";
import { getFilingPeriod } from "@/lib/filings/period-store";
import { cancelFilingClosing, updateFilingPeriod } from "@/lib/portal/filing-actions";
import { settle } from "@/lib/portal/settle";

/** Where things stand, for the overview at the top of the page. */
function describePeriod(period: ApplicationPeriod, noun: string) {
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const closes = closingTime(period);
  const when = closes === null ? "" : formatClosing(new Date(closes).toISOString());
  if (isClosingSoon(period)) return { state: "closing" as const, headline: `Closing ${noun}`, detail: `Closes ${when}, after the grace period. Anyone partway through can still submit.`, closesAt: closes };
  if (period.mode === "closed") return { state: "closed" as const, headline: `${Noun} closed`, detail: period.updatedBy && period.updatedBy !== "system" ? `Closed manually${closes === null ? "" : ` ${when}`}. The public page says it isn’t open.` : "Not opened yet. The public page says it isn’t open.", closesAt: null };
  if (closes === null) return { state: "open" as const, headline: `Accepting ${noun}`, detail: "Open with no closing date.", closesAt: null };
  return isAccepting(period)
    ? { state: "open" as const, headline: `Accepting ${noun}`, detail: `Closes ${when}`, closesAt: closes }
    : { state: "closed" as const, headline: `${Noun} closed`, detail: `Closed automatically ${when}`, closesAt: null };
}

/** The Settings subtab of PolPaR and of Filing of Candidacy: open or close it, like Recruitment → Settings. */
export async function FilingSettings({ kind, notice }: { kind: FilingKind; notice?: string | string[] }) {
  const { title, section, noun, href } = filingKinds[kind];
  const [, { value: period, error: loadError }] = await withPortalUser(settle(getFilingPeriod(kind)), requireCentral);
  // The seeded row says "system"; only name a person once someone has changed it.
  const updated = period?.updatedAt && period.updatedBy && period.updatedBy !== "system" ? `Last changed by ${period.updatedBy} · ${formatClosing(period.updatedAt)}` : null;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">{section}</p>
          <TitleWithInfo info={`Open or close ${title}, on a schedule or right now.`}>Settings</TitleWithInfo>
        </div>
        <Link className="portal-button is-ghost" href={href} target="_blank">View Mode <ArrowUpRight size={15} /></Link>
      </header>
      <Notice notice={notice} />

      {period ? (
        <>
          <PeriodOverview {...describePeriod(period, noun)} updated={updated} cancelAction={cancelFilingClosing.bind(null, kind)} label={`${title} status`} />
          <section className="portal-card portal-settings" aria-labelledby="filing-period-title">
            <header className="portal-settings-head">
              <TitleWithInfo as="h2" className="portal-card-title" id="filing-period-title" info={`Controls whether the ${title} page is open, and the countdown it shows.`}>Filing period</TitleWithInfo>
            </header>
            <ApplicationPeriodForm
              key={`${period.mode}-${period.closesAt}`}
              action={updateFilingPeriod.bind(null, kind)}
              mode={period.mode}
              closesAt={period.closesAt}
              copy={{ noun, page: `the ${title} page` }}
            />
          </section>
        </>
      ) : (
        <p className="portal-form-error" role="alert">
          Couldn’t load the filing period. Run <code>supabase/migrations/0015_filing_periods.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      )}
    </main>
  );
}

/** The list subtab of PolPaR and of Filing of Candidacy. There's no online form yet, so nothing comes in. */
export async function FilingSubmissions({ kind }: { kind: FilingKind }) {
  const { title, section, noun, href, portalHref } = filingKinds[kind];
  const user = await requirePortalUser();
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  // Local accounts only see their own college's, once there are any.
  const local = isLocal(user);

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">{section}</p>
          <TitleWithInfo info={local ? `${Noun} from ${user.college ?? "your college"} submitted through the ${title} page will show up here.` : `${Noun} submitted through the ${title} page will show up here.`}>{Noun}</TitleWithInfo>
          {local && <p className="portal-muted">{user.college}</p>}
        </div>
        <Link className="portal-button is-ghost" href={href} target="_blank">View Mode <ArrowUpRight size={15} /></Link>
      </header>

      <section className="portal-card">
        {local ? (
          <p className="portal-empty">No {noun} from your college yet.</p>
        ) : (
          <p className="portal-empty">No {noun} yet. Open or close {title} under <Link href={`${portalHref}/settings`}>Settings</Link>.</p>
        )}
      </section>
    </main>
  );
}
