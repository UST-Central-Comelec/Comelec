import type { Metadata } from "next";
import { AutomaticEmails, AutomaticStatus, type AutomaticItemGroup } from "@/components/portal/automatic-emails";
import { EmailPreview } from "@/components/portal/email-preview";
import { EmailTabs } from "@/components/portal/email-tabs";
import { InfoTip, TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { formatClosing } from "@/lib/applications/period";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { isEmailConfigured } from "@/lib/email/send";
import { LOGO_CID, LOGO_PATH } from "@/lib/email/template";
import { automaticEmails, findAutomaticEmail, sampleLocal } from "@/lib/notifications/catalog";
import { CENTRAL, unitOf } from "@/lib/notifications/concern";
import { getSavedSwitches, isSwitchesMissing } from "@/lib/notifications/switch-store";
import { emailDefaults, switchesWith } from "@/lib/notifications/switches";
import { switchesEmails } from "@/lib/portal/access";
import { updateEmailSwitches } from "@/lib/portal/email-switch-actions";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Automatic emails" };

const PAGE = "/portal/apps/email/automatic";

/**
 * Every email the site sends by itself, each with its switch: when it goes, who gets it, and what
 * it looks like, shown with made-up details. Nothing is sent from here.
 */
export default async function AutomaticEmailsPage({ searchParams }: PageProps<"/portal/apps/email/automatic">) {
  const [user, [{ email: picked, unit, notice }, { value: saved, error: loadError }]] = await withPortalUser(Promise.all([searchParams, settle(getSavedSwitches())]), allowed("apps/email"));
  // Until they can be read, every email is shown on its default, which is what it's sent by.
  const switches = saved?.switches ?? switchesWith();
  const canSwitch = switchesEmails(user.level);
  const email = findAutomaticEmail(typeof picked === "string" ? picked : undefined) ?? automaticEmails[0].emails[0];
  // The commission's settings and texts are always the Central Comelec's, so those are only ever shown as Central.
  const local = unit === "local" && email.byUnit;
  const concern = local ? sampleLocal : CENTRAL;
  const sample = email.sample(concern);
  const from = `${process.env.EMAIL_FROM_NAME?.trim() || "UST Central Comelec"}${process.env.SMTP_USER?.trim() ? ` <${process.env.SMTP_USER.trim()}>` : ""}`;
  const href = (id: string, shownAs = local) => `${PAGE}?email=${id}${shownAs ? "&unit=local" : ""}`;
  const groups: AutomaticItemGroup[] = automaticEmails.map((group) => ({
    label: group.label,
    emails: group.emails.map((item) => ({ key: item.id, name: item.name, href: href(item.id), on: switches[item.id], byDefault: emailDefaults[item.id], waiting: Boolean(item.waiting) })),
  }));
  const updated = saved?.updated && saved.updated.by !== "system" ? `Last changed by ${saved.updated.by} · ${formatClosing(saved.updated.at)}` : null;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Apps</p>
          <TitleWithInfo info="The emails the site sends by itself: receipts, results, and notices to the commission. Each has a switch beside its name: switched off, it stops going out from the next time it would, until it’s switched back on. All of them leave from the Central Comelec’s mailbox. One about a Local unit says it came through the Central Comelec COMET, and goes to that unit’s official account and Executive Board only; one about the Central Comelec goes to the Central Comelec’s only.">Email Sender</TitleWithInfo>
        </div>
        {user.readOnly && <ViewOnlyTag />}
      </header>
      <EmailTabs current="automatic" compose={!user.readOnly} />
      <Notice notice={notice} />

      {!isEmailConfigured() && <p className="portal-form-error" role="alert">Email isn’t set up on the server yet, so none of these are sent whatever is switched on. Set <code>SMTP_USER</code> and <code>SMTP_PASSWORD</code> in <code>.env.local</code>, then restart the server.</p>}
      {loadError && canSwitch && (
        <p className="portal-form-error" role="alert">
          {isSwitchesMissing(loadError) ? <>The switches need a database update before they can be saved, so every email follows its default. Run <code>supabase/migrations/0026_email_settings.sql</code> in the Supabase SQL Editor, then reload.</> : <>Couldn’t load the saved switches, so every email is shown on its default. Reload the page to try again. ({loadError})</>}
        </p>
      )}

      {/* Keyed on what's saved, so the switches follow it after a save. */}
      <AutomaticEmails key={JSON.stringify(switches)} action={canSwitch ? updateEmailSwitches : null} groups={groups} current={email.id} local={local} updated={updated}>
        <section className="portal-card">
          <header className="portal-card-head">
            <div className="portal-title-row">
              <h2 className="portal-card-title">{email.name}</h2>
              {email.waiting && <InfoTip warn label="Not sending yet">Its form isn’t built yet, so nothing sends this today. The email is ready, and goes out from the day the form does.</InfoTip>}
            </div>
            <AutomaticStatus email={email.id} waiting={Boolean(email.waiting)} />
          </header>
          <dl className="portal-details">
            <div><dt>Sent when</dt><dd>{email.when}</dd></div>
            <div><dt>Goes to</dt><dd>{email.to(concern)}</dd></div>
            <div><dt>Concerns</dt><dd>{email.byUnit ? `${unitOf(concern)}${local ? " (a Local unit, as an example)" : ""}` : "The Central Comelec, always: the commission’s settings and texts are its own"}</dd></div>
          </dl>
          {email.caution && <p className="email-auto-note portal-muted">{email.caution}</p>}
        </section>

        {email.byUnit && (
          <SlidingFilters
            label="Shown for"
            active={local ? "local" : "central"}
            items={[
              { key: "central", href: href(email.id, false), label: "Central Comelec" },
              { key: "local", href: href(email.id, true), label: "A Local unit" },
            ]}
          />
        )}

        <EmailPreview html={sample.html.replaceAll(`cid:${LOGO_CID}`, LOGO_PATH)} from={from} to={sample.to} subject={sample.subject} />
        <p className="email-auto-note portal-muted">Shown with made-up details. The real email carries the person’s own.</p>
      </AutomaticEmails>
    </main>
  );
}
