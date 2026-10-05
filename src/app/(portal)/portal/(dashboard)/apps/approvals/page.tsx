import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Stamp } from "lucide-react";
import { Signers, formatWhen } from "@/components/portal/code-revision";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { describeStats } from "@/lib/codes/diff";
import { approverRoleOf, approverRoles, codes, describeRevision, type RevisionSummary } from "@/lib/codes/options";
import { isCodesMissing, listRevisions } from "@/lib/codes/store";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Approvals" };

const views = { waiting: "Waiting", decided: "Decided" } as const;
type View = keyof typeof views;

/** When the last thing happened to it: it was sent, sent back, or published. */
const lastMoved = (revision: RevisionSummary) => revision.decidedAt ?? revision.returned?.at ?? revision.submitted?.at ?? revision.updatedAt;

/**
 * Apps → Approvals, which only the Central Executive Board has: the revisions of the Constitution
 * and the Elections Code that were sent for approval. The Chairperson, the Vice Chairperson and the
 * Secretary to the Executive approve them or send them back; the rest of the board follows along.
 */
export default async function ApprovalsPage({ searchParams }: PageProps<"/portal/apps/approvals">) {
  const [user, [{ notice, show }, revisions]] = await withPortalUser(Promise.all([searchParams, settle(listRevisions())]), allowed("apps/approvals"));
  const office = user.readOnly ? null : approverRoleOf(user);
  const all = revisions.value ?? [];
  // What's waiting, longest first; then what was decided, latest first.
  const waiting = all.filter((revision) => revision.status === "pending").sort((a, b) => lastMoved(a).localeCompare(lastMoved(b)));
  const decided = all.filter((revision) => revision.status === "approved" || (revision.status === "draft" && revision.returned)).sort((a, b) => lastMoved(b).localeCompare(lastMoved(a)));
  const view: View = show === "decided" ? "decided" : "waiting";
  const rows = view === "waiting" ? waiting : decided;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Apps</p>
          <TitleWithInfo info={`Revisions of the Constitution and the Elections Code that were sent for approval. Each is published on the website once the ${approverRoles.slice(0, -1).join(", the ")} and the ${approverRoles.at(-1)} have all approved it; any of the three can send it back for changes instead. Only the Central Executive Board has this tab.`}>Approvals</TitleWithInfo>
        </div>
        {office ? <span className="portal-tag is-gold"><Stamp size={12} aria-hidden="true" /> You approve as {office}</span> : <span className="portal-tag portal-view-only-tag" title={`Approving is for the ${approverRoles.slice(0, -1).join(", the ")} and the ${approverRoles.at(-1)}.`}><Eye size={12} aria-hidden="true" /> Following only</span>}
      </header>
      <Notice notice={notice} />

      {revisions.error && (
        <p className="portal-form-error" role="alert">
          {isCodesMissing(revisions.error) ? <>Approvals need a database update first. Run <code>supabase/migrations/0025_code_revisions.sql</code> in the Supabase SQL Editor, then reload.</> : <>Couldn’t load what’s waiting. Reload the page to try again. ({revisions.error})</>}
        </p>
      )}

      <SlidingFilters label="Show" active={view} items={(Object.keys(views) as View[]).map((key) => ({ key, href: key === "waiting" ? "/portal/apps/approvals" : `/portal/apps/approvals?show=${key}`, label: <>{views[key]}<small>{key === "waiting" ? waiting.length : decided.length}</small></> }))} />

      <section className="portal-card is-flush">
        {rows.length === 0 ? (
          <p className="portal-empty">{view === "waiting" ? "Nothing is waiting for approval." : "Nothing has been decided yet."}</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table code-revisions">
              <thead><tr><th>Revision</th><th>Sent by</th><th>Approvals</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((revision) => {
                  const state = describeRevision(revision);
                  // Theirs to sign: their own office's approval is missing.
                  const signs = office;
                  const due = revision.status === "pending" && signs !== null && !revision.approvals[signs];
                  const sender = revision.submitted ?? revision.author;
                  return (
                    <tr key={revision.id} className={due ? "portal-request-row" : undefined}>
                      <td>
                        <Link className="portal-row-title" href={`/portal/apps/approvals/${revision.id}`}>{revision.version ? `Version ${revision.version}` : "Revision"} of {codes[revision.code].the}</Link>
                        <small className="portal-muted code-revisions-note">{describeStats(revision.stats)}{revision.summary && ` · ${revision.summary}`}</small>
                      </td>
                      <td>{sender.name}<small className="portal-muted">{sender.role}{revision.submitted && ` · ${formatWhen(revision.submitted.at)}`}</small></td>
                      <td><Signers revision={revision} compact /></td>
                      <td><span className={`portal-tag ${due ? "is-gold" : state.tone}`}>{due ? "Needs your approval" : state.label}</span><small className="portal-muted">{formatWhen(lastMoved(revision))}</small></td>
                      <td className="portal-row-actions"><Link href={`/portal/apps/approvals/${revision.id}`}>{due ? "Review" : "Open"}</Link></td>
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
