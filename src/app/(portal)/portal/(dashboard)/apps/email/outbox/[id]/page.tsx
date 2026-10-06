import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyPlus, Send, X } from "lucide-react";
import { ActionButton, DeleteButton } from "@/components/portal/delete-button";
import { EmailPreview } from "@/components/portal/email-preview";
import { Notice } from "@/components/portal/notice";
import { OutboxRefresh } from "@/components/portal/outbox-refresh";
import { formatClosing } from "@/lib/applications/period";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import { recipientsOf } from "@/lib/email/audience";
import { messageHtml } from "@/lib/email/body";
import { canSeeEmail, getOutboxEmail, type Delivery } from "@/lib/email/outbox";
import { describeOutbox, isMoving } from "@/lib/email/outbox-status";
import { LOGO_PATH } from "@/lib/email/template";
import { cancelScheduledEmail, sendScheduledEmailNow } from "@/lib/portal/email-actions";

export const metadata: Metadata = { title: "Email" };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

export default async function OutboxEmailPage({ params, searchParams }: PageProps<"/portal/apps/email/outbox/[id]">) {
  const [user, [{ id }, { notice }]] = await withPortalUser(Promise.all([params, searchParams]), allowed("apps/email"));
  const email = await getOutboxEmail(id).catch(() => null);
  if (!email || !canSeeEmail(user, email)) notFound();

  const state = describeOutbox(email);
  const waiting = email.status === "scheduled";
  // Until it goes out there's no list of who got it, only who would get it if it went now.
  const expected: Delivery[] = waiting
    ? recipientsOf(email.audience, (await store.list("accounts").catch(() => [])).map(toSummary).filter((account) => account.active), { affiliation: email.senderAffiliation, college: email.senderCollege }).map(({ name, email: address }) => ({ name, email: address, sent: false }))
    : [];
  const people = waiting ? expected : email.deliveries;
  const missed = email.deliveries.filter((delivery) => email.sendToEmail && !(delivery.emailSent ?? delivery.sent)).length;
  const from = `${process.env.EMAIL_FROM_NAME?.trim() || "UST Central Comelec"}${process.env.SMTP_USER?.trim() ? ` <${process.env.SMTP_USER.trim()}>` : ""}`;
  const count = waiting ? expected.length : email.recipientCount;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/apps/email/outbox">← Outbox</Link>
          <h1>{email.subject}</h1>
        </div>
        <div className="portal-head-actions">
          <span className={`portal-tag portal-status-tag ${state.tone}`}>{state.label}</span>
          {!user.readOnly && waiting && email.scheduled && (
            <>
              <ActionButton action={sendScheduledEmailNow.bind(null, email.id)} label="Send now" pendingLabel="Sending…" icon={<Send size={15} aria-hidden="true" />} />
              <DeleteButton action={cancelScheduledEmail.bind(null, email.id)} label="Cancel email" prompt="Cancel this email? It won’t be sent." confirmLabel="Yes, cancel it" pendingLabel="Cancelling…" icon={<X size={15} aria-hidden="true" />} tone="quiet" />
            </>
          )}
          {!user.readOnly && <Link className="portal-button is-ghost" href={`/portal/apps/email?from=${email.id}`}><CopyPlus size={15} aria-hidden="true" /> Use again</Link>}
        </div>
      </header>
      <Notice notice={notice} />
      <OutboxRefresh active={isMoving(email)} />
      {email.error && <p className="portal-form-error" role="alert">{email.error}</p>}

      <div className="email-compose is-sent">
        <div className="email-compose-side">
          <EmailPreview html={messageHtml(email, { name: email.senderName, email: email.senderEmail, unit: email.senderUnit }, LOGO_PATH)} from={from} to={`${count} ${count === 1 ? "recipient" : "recipients"} · ${email.audienceLabel}`} subject={email.subject} />
        </div>

        <div className="portal-application-stack">
          <section className="portal-card">
            <h2 className="portal-card-title">Delivery</h2>
            <dl className="portal-details">
              <Detail label="Status">{state.label}<small className="portal-muted email-detail-note">{state.when}</small></Detail>
              <Detail label="Recipients">{email.audienceLabel}</Detail>
              <Detail label="Send to">{[email.sendToEmail && "Email address", email.sendToInbox && "Portal inbox"].filter(Boolean).join(" and ")}</Detail>
              <Detail label={email.scheduled ? "Scheduled for" : "Sent on"}>{formatClosing(email.sendAt)}</Detail>
              {!waiting && email.recipientCount > 0 && <Detail label="Delivered">{email.sentCount} of {email.recipientCount}</Detail>}
              {!waiting && email.deliveries.length > 0 && email.sendToEmail && <Detail label="Email delivered">{email.deliveries.filter((delivery) => delivery.emailSent ?? delivery.sent).length} of {email.recipientCount}</Detail>}
              {!waiting && email.deliveries.length > 0 && email.sendToInbox && <Detail label="Inbox delivered">{email.deliveries.filter((delivery) => delivery.inboxSent).length} of {email.recipientCount}</Detail>}
              <Detail label="Written by">{email.senderName}<small className="portal-muted email-detail-note">{email.senderUnit} · {email.senderEmail}</small></Detail>
              <Detail label="Written on">{formatClosing(email.createdAt)}</Detail>
            </dl>
          </section>

          <section className="portal-card is-flush">
            <header className="email-people-head">
              <h2 className="portal-card-title">{waiting ? "Who matches right now" : "Who it went to"}</h2>
              <span className="portal-index">{people.length}</span>
            </header>
            {people.length === 0 ? (
              <p className="portal-empty">{waiting ? "Nobody matches the recipients right now." : email.status === "sending" ? "The list appears once it has finished sending." : "It didn’t go to anyone."}</p>
            ) : (
              <ul className="email-people">
                {people.map((person) => (
                  <li key={person.email}>
                    <span>{person.name}<small>{person.email}</small></span>
                    {!waiting && <span>
                      {email.sendToEmail && <span className={`portal-tag ${(person.emailSent ?? person.sent) ? "is-ok" : "is-warn"}`}>{(person.emailSent ?? person.sent) ? "Email sent" : "Email failed"}</span>}
                      {email.sendToInbox && <span className={`portal-tag ${person.inboxSent ? "is-ok" : "is-warn"}`}>{person.inboxSent ? "Inbox sent" : "Inbox failed"}</span>}
                    </span>}
                  </li>
                ))}
              </ul>
            )}
            {waiting && people.length > 0 && <p className="email-people-note portal-muted">The list is worked out again when the email goes out, so it follows any change to the accounts until then.</p>}
            {!waiting && missed > 0 && <p className="email-people-note portal-muted">{missed === 1 ? "1 copy" : `${missed} copies`} couldn’t be sent. The address may be wrong, or the mail server refused it.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
