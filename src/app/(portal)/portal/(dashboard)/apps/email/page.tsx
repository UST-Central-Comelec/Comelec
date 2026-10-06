import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmailComposer, type ComposerDraft } from "@/components/portal/email-composer";
import { EmailTabs } from "@/components/portal/email-tabs";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { comelecUnits } from "@/lib/applications/options";
import { toManilaInput } from "@/lib/applications/period";
import { requireAccess } from "@/lib/auth/session";
import { properName, toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import { accountAffiliations } from "@/lib/data/types";
import { canReach, defaultAudience, fixedUnit, type Person } from "@/lib/email/audience";
import { canSeeEmail, getOutboxEmail, listOutbox } from "@/lib/email/outbox";
import { isEmailConfigured } from "@/lib/email/send";
import { comelecUnit } from "@/lib/events/options";
import { sendMessage, sendTestMessage } from "@/lib/portal/email-actions";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Email Sender" };

const HOUR = 60 * 60_000;

/** Manila wall-clock values for the schedule field: where it starts (the next full hour, at least an hour away) and the earliest it takes. */
function scheduleBounds() {
  const now = Date.now();
  return { sendAtDefault: toManilaInput(new Date(Math.ceil((now + HOUR) / HOUR) * HOUR).toISOString()), sendAtMin: toManilaInput(new Date(now).toISOString()) };
}

export default async function PortalEmailSenderPage({ searchParams }: PageProps<"/portal/apps/email">) {
  const user = await requireAccess("apps/email");
  // Advisers and Admins read what was sent; they don't write.
  if (user.readOnly) redirect("/portal/apps/email/outbox");

  const { from } = await searchParams;
  const [accounts, outbox, source] = await Promise.all([settle(store.list("accounts")), settle(listOutbox(user)), typeof from === "string" ? getOutboxEmail(from).catch(() => null) : null]);

  // Active accounts this sender can reach: everyone for a Central account, its own college's for a Local one.
  const people: Person[] = (accounts.value ?? [])
    .map(toSummary)
    .filter((account) => account.active && canReach(user, account))
    .map(({ name, email, kind, affiliation, college, position, role }) => ({ name, email, kind, affiliation, college, position, role }));

  const lockedUnit = fixedUnit(user);
  // "Use again" on an email in the Outbox starts from what it said and who it was for.
  const reused = source && canSeeEmail(user, source) ? source : null;
  const draft: ComposerDraft = reused
    ? { subject: reused.subject, title: reused.title, body: reused.body, audience: { ...reused.audience, units: lockedUnit ? [lockedUnit] : reused.audience.units }, sendToEmail: reused.sendToEmail, sendToInbox: reused.sendToInbox }
    : { subject: "", title: "", body: [], audience: { ...defaultAudience, units: lockedUnit ? [lockedUnit] : [] } };

  const sender = { name: properName(user.name), email: user.email, unit: user.affiliation === "osa" ? accountAffiliations.osa : comelecUnit(user.affiliation, user.college) };
  const fromName = `${process.env.EMAIL_FROM_NAME?.trim() || "UST Central Comelec"}${process.env.SMTP_USER?.trim() ? ` <${process.env.SMTP_USER.trim()}>` : ""}`;
  const waiting = (outbox.value ?? []).filter((email) => email.status === "scheduled" && email.scheduled).length;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Apps</p>
          <TitleWithInfo info="Write one email and send it to a group of the portal’s accounts: every commissioner, one unit, one position or one role. Each person gets their own copy, so nobody sees anyone else’s address, and replies come to you. Send it now, or schedule it.">Email Sender</TitleWithInfo>
        </div>
      </header>
      <EmailTabs current="compose" waiting={waiting} />

      {!isEmailConfigured() && <p className="portal-form-error" role="alert">Email delivery isn’t set up on the server yet. You can send to the portal inbox. To enable email delivery, set <code>SMTP_USER</code> and <code>SMTP_PASSWORD</code> in <code>.env.local</code>, then restart the server.</p>}
      {accounts.error && <p className="portal-form-error" role="alert">Couldn’t load the accounts, so there’s nobody to send to. Reload the page to try again. ({accounts.error})</p>}

      <EmailComposer
        key={reused?.id ?? "new"}
        action={sendMessage}
        testAction={sendTestMessage}
        people={people}
        units={comelecUnits}
        reach={{ affiliation: user.affiliation, college: user.college }}
        lockedUnit={lockedUnit}
        sender={sender}
        fromName={fromName}
        draft={draft}
        {...scheduleBounds()}
      />
    </main>
  );
}
