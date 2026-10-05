import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ActingAs } from "@/components/portal/event-tags";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { PeriodOverview } from "@/components/portal/period-overview";
import { UnitPeriodForm } from "@/components/portal/unit-period-form";
import { UnitSwitcher } from "@/components/portal/unit-switcher";
import { ViewOnly, ViewOnlyTag } from "@/components/portal/view-only";
import { comelecUnits } from "@/lib/applications/options";
import { closingTime, formatClosing, isAccepting, isClosingSoon, isUpcoming, type ApplicationPeriod } from "@/lib/applications/period";
import { requireAccess } from "@/lib/auth/session";
import { canManageEvent, canSeeInside, isOwn, unitOfAccount } from "@/lib/events/access";
import { manilaToday } from "@/lib/events/format";
import { blankDetails, comelecUnit } from "@/lib/events/options";
import { listingId, localUnit, periodKinds, unitKey, type PeriodKind } from "@/lib/periods/kinds";
import { getUnitPeriod } from "@/lib/periods/store";
import { cancelUnitClosing, updateUnitPeriod } from "@/lib/portal/period-actions";
import { settle } from "@/lib/portal/settle";

/** Where things stand, for the overview at the top of the page. */
function describePeriod(period: ApplicationPeriod, noun: string) {
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const closes = closingTime(period);
  const when = closes === null ? "" : formatClosing(new Date(closes).toISOString());
  if (isUpcoming(period)) return { state: "closed" as const, headline: `Opens ${formatClosing(period.opensAt!)}`, detail: "", closesAt: null };
  if (isClosingSoon(period)) return { state: "closing" as const, headline: `Closing ${noun}`, detail: `Closes ${when}, after the grace period. Anyone partway through can still submit.`, closesAt: closes };
  if (period.mode === "closed") return { state: "closed" as const, headline: `${Noun} closed`, detail: period.updatedBy && period.updatedBy !== "system" ? `Closed manually${closes === null ? "" : ` ${when}`}. The public page says it isn’t open.` : "Not opened yet. The public page says it isn’t open.", closesAt: null };
  if (closes === null) return { state: "open" as const, headline: `Accepting ${noun}`, detail: "Open with no closing date.", closesAt: null };
  return isAccepting(period)
    ? { state: "open" as const, headline: `Accepting ${noun}`, detail: `Closes ${when}`, closesAt: closes }
    : { state: "closed" as const, headline: `${Noun} closed`, detail: `Closed automatically ${when}`, closesAt: null };
}

/** The date in Manila of a moment, as YYYY-MM-DD. */
const manilaDay = (iso: string) => manilaToday(Date.parse(iso));

/**
 * The Settings subtab of Recruitment, of Political Party and of Filing of Candidacy. Every unit has
 * its own: the page shows the signed-in account's unit's, and a Central account can turn to any
 * Local unit's (?unit=), to read it or, as the Central Executive Board, to change it. Two parts:
 * whether it's open, and the event details it's listed under on the Events page while it is.
 */
export async function PeriodSettings({ kind, notice, unit: asked }: { kind: PeriodKind; notice?: string | string[]; unit?: string | string[] }) {
  const { title, section, noun, href, tab } = periodKinds[kind];
  const user = await requireAccess(tab);
  const own = unitOfAccount(user);
  // Another unit's settings, where the account may read them. A Local account only ever has its own.
  const other = typeof asked === "string" && comelecUnits.includes(asked) && canSeeInside(user, localUnit(asked)) ? localUnit(asked) : null;
  const unit = other ?? own;
  const preview = kind === "recruitment" ? "/apply/preview" : href;

  const head = (
    <header className="portal-page-head">
      <div>
        <p className="portal-eyebrow">{section}</p>
        <TitleWithInfo info={`Set when ${title} opens and closes, and the event details it’s listed under on the Events page while it’s open. The Central Comelec and every Local Comelec unit have their own, and each unit manages its own.`}>Settings</TitleWithInfo>
      </div>
      <div className="portal-head-actions">
        {user.affiliation !== "local" && <UnitSwitcher units={comelecUnits} value={unit ? unitKey(unit) : ""} />}
        <Link className="portal-button is-ghost" href={preview} target="_blank">View Mode <ArrowUpRight size={15} /></Link>
      </div>
    </header>
  );

  if (!unit) {
    return (
      <main className="portal-page">
        {head}
        <p className="portal-form-error" role="alert">Your account has no college set, so there’s no unit whose {title} to manage. Ask the Central Executive Board to set it under Accounts.</p>
      </main>
    );
  }

  const { value: period, error: loadError } = await settle(getUnitPeriod(kind, unit));
  const manages = canManageEvent(user, unit);
  const key = unitKey(unit);
  // The seeded row says "system"; only name a person once someone has changed it.
  const updated = period?.updatedAt && period.updatedBy && period.updatedBy !== "system" ? `Last changed by ${period.updatedBy} · ${formatClosing(period.updatedAt)}` : null;
  const open = period ? isAccepting(period) : false;
  const listed = open && Boolean(period?.details);
  const unitName = comelecUnit(unit.organizer, unit.college);

  return (
    <main className="portal-page">
      {head}
      <ActingAs unit={unit} after={manages ? null : <> · view only</>}>
        {manages ? (isOwn(user, unit) ? `You’re managing ${title} as` : `You’re managing ${title} for the`) : `You’re viewing ${title} for the`}
      </ActingAs>
      <Notice notice={notice} />

      {period ? (
        <>
          <PeriodOverview {...describePeriod(period, noun)} updated={updated} cancelAction={manages ? cancelUnitClosing.bind(null, kind, key) : undefined} label={`${title} status`} />
          <section className="portal-card portal-event-section" id="details" aria-labelledby="details-title">
            <header className="portal-card-head">
              <TitleWithInfo as="h2" className="portal-card-title" id="details-title" info={`When ${title} runs for the ${unitName}, and the event details it’s listed under on the website’s Events page and in the portal’s Events tab while it’s open. It opens at the start date and time, and closes by itself at the end date and time. ${kind === "recruitment" ? "Track application keeps working either way." : ""}`}>{kind === "recruitment" ? "Application period" : "Filing period"}</TitleWithInfo>
              {!manages ? <ViewOnlyTag /> : listed
                ? <a className="portal-tag is-ok" href={`/events/${listingId(kind, unit)}`} target="_blank" rel="noreferrer">On the Events page <ArrowUpRight size={12} aria-hidden="true" /></a>
                : open && !period.details
                  ? <span className="portal-tag is-warn">Not on the Events page yet</span>
                  : period.details && isUpcoming(period)
                    ? <span className="portal-tag is-gold">In the portal’s Events list · public once it opens</span>
                    : <span className="portal-tag">Listed while it’s open</span>}
            </header>
            {open && !period.details && <p className="portal-form-note portal-muted">This is open, but it isn’t on the Events page: it has no dates or event details yet. {manages ? "Fill them in and save, and it’s listed straight away." : "The unit that manages it has to fill them in."}</p>}
            <ViewOnly when={!manages}>
              <UnitPeriodForm
                key={`${key}-${period.mode}-${period.closesAt}-${period.detailsUpdatedAt}`}
                action={updateUnitPeriod.bind(null, kind, key)}
                mode={period.mode}
                noun={noun}
                allowBothVenue={kind === "recruitment"}
                studentsOnly={kind === "recruitment"}
                // A form that's still empty starts with the kind's own name, from today until the day it closes if that's set.
                initial={period.details ?? { ...blankDetails(manilaToday()), name: title, ...(period.closesAt ? { endDate: manilaDay(period.closesAt), endsTime: "23:55" } : {}) }}
              />
            </ViewOnly>
          </section>
        </>
      ) : (
        <p className="portal-form-error" role="alert">
          Couldn’t load the settings. Run <code>supabase/migrations/0027_unit_periods.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      )}
    </main>
  );
}
