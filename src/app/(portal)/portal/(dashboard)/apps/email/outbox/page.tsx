import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { PenLine } from "lucide-react";
import { EmailTabs } from "@/components/portal/email-tabs";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { OutboxRefresh } from "@/components/portal/outbox-refresh";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { dispatchDueEmails } from "@/lib/email/dispatch";
import { isOutboxMissing, listOutbox, type OutboxEmail } from "@/lib/email/outbox";
import { describeOutbox, isMoving } from "@/lib/email/outbox-status";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Outbox" };

const views = { all: "All", scheduled: "Scheduled", sent: "Sent" } as const;
type View = keyof typeof views;

const inView = (view: View, email: OutboxEmail) => view === "all" || (view === "scheduled" ? email.status === "scheduled" || email.status === "sending" : email.status !== "scheduled" && email.status !== "sending");

export default async function EmailOutboxPage({ searchParams }: PageProps<"/portal/apps/email/outbox">) {
  const [user, { notice, show }] = await withPortalUser(searchParams, allowed("apps/email"));
  const { value, error } = await settle(listOutbox(user));
  const emails = value ?? [];
  // A scheduled email that's due goes out when this page is opened, if nothing else has sent it yet.
  after(() => dispatchDueEmails().catch(() => {}));

  const view: View = typeof show === "string" && show in views ? (show as View) : "all";
  // What's still to go first, soonest at the top; then what's done, latest first.
  const waiting = emails.filter((email) => email.status === "scheduled" || email.status === "sending").sort((a, b) => a.sendAt.localeCompare(b.sendAt));
  const done = emails.filter((email) => !waiting.includes(email));
  const rows = [...waiting, ...done].filter((email) => inView(view, email));
  const counts: Record<View, number> = { all: emails.length, scheduled: waiting.length, sent: done.length };

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Apps</p>
          <TitleWithInfo info="Every email written in the Email Sender: what’s scheduled, what’s going out, and what was sent, with who got it. A scheduled email can be cancelled or sent early until it starts sending.">Email Sender</TitleWithInfo>
        </div>
        {user.readOnly ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/apps/email"><PenLine size={16} /> Write an email</Link>}
      </header>
      <EmailTabs current="outbox" compose={!user.readOnly} waiting={emails.filter((email) => email.status === "scheduled" && email.scheduled).length} />
      <Notice notice={notice} />
      <OutboxRefresh active={emails.some((email) => isMoving(email))} />

      {error && (
        <p className="portal-form-error" role="alert">
          {isOutboxMissing(error) ? <>The Outbox needs a database update first. Run <code>supabase/migrations/0024_email_sender.sql</code> in the Supabase SQL Editor, then reload.</> : <>Couldn’t load the Outbox. Reload the page to try again. ({error})</>}
        </p>
      )}

      {emails.length > 0 && (
        <SlidingFilters
          label="Show"
          active={view}
          items={(Object.keys(views) as View[]).map((key) => ({ key, href: key === "all" ? "/portal/apps/email/outbox" : `/portal/apps/email/outbox?show=${key}`, label: <>{views[key]}<small>{counts[key]}</small></> }))}
        />
      )}

      <section className="portal-card is-flush">
        {rows.length === 0 ? (
          <p className="portal-empty">
            {emails.length === 0 ? <>No emails yet.{!user.readOnly && <> <Link href="/portal/apps/email">Write the first one.</Link></>}</> : view === "scheduled" ? "Nothing is scheduled." : "Nothing has been sent yet."}
          </p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table email-outbox">
              <thead><tr><th>Subject</th><th>Recipients</th><th>Status</th><th>Sent by</th><th /></tr></thead>
              <tbody>
                {rows.map((email) => {
                  const state = describeOutbox(email);
                  return (
                    <tr key={email.id}>
                      <td><Link className="portal-row-title" href={`/portal/apps/email/outbox/${email.id}`}>{email.subject}</Link></td>
                      <td>
                        {email.audienceLabel}
                        {email.recipientCount > 0 && <small className="portal-muted">{email.status === "sent" && email.sentCount < email.recipientCount ? `${email.sentCount} of ${email.recipientCount} delivered` : `${email.recipientCount} ${email.recipientCount === 1 ? "recipient" : "recipients"}`}</small>}
                      </td>
                      <td><span className={`portal-tag ${state.tone}`}>{state.label}</span><small className="portal-muted">{state.when}</small></td>
                      <td>{email.senderName}<small className="portal-muted">{email.senderUnit}</small></td>
                      <td className="portal-row-actions"><Link href={`/portal/apps/email/outbox/${email.id}`}>Open</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
