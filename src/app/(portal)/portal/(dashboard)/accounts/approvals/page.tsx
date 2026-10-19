import type { Metadata } from "next";
import Link from "next/link";
import { AddIcon as Plus, EditIcon as ActionEditIcon, ViewIcon as ActionViewIcon } from "@/components/action-icons";
import { AccountKindLabel, AccountStatusLabel } from "@/components/portal/account-badges";
import { AccessRequestRow, EditRequestRow } from "@/components/portal/access-requests";
import { AccountsTabs } from "@/components/portal/accounts-tabs";
import { AccountsUnitFilter } from "@/components/portal/accounts-unit-filter";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { listPendingAccessRequests } from "@/lib/access-requests/admin";
import { listSubmissionEditReviews } from "@/lib/applications/edit-requests";
import { comelecUnits, unitAbbreviations } from "@/lib/applications/options";
import { allowed, builtInUser, isLocal, withPortalUser } from "@/lib/auth/session";
import { accountStatusOf, listName, positionName } from "@/lib/data/accounts";
import { getAccounts } from "@/lib/data/queries";
import { FULL_ACCESS } from "@/lib/portal/access";
import { canDecideRequest, canManageAccount, canSeeUnit } from "@/lib/portal/account-scope";
import { settle } from "@/lib/portal/settle";
import { matchesUnit } from "@/lib/portal/unit-filter";

export const metadata: Metadata = { title: "Approvals" };

export default async function AccountApprovalsPage({ searchParams }: PageProps<"/portal/accounts/approvals">) {
  const { notice, unit: unitParam } = await searchParams;
  const builtIn = builtInUser();
  const [me, [everyAccount, { value: everyRequest, error: requestsError }, edits]] = await withPortalUser(Promise.all([getAccounts(builtIn?.email), settle(listPendingAccessRequests()), settle(listSubmissionEditReviews("access"))]), allowed("accounts"));

  // A Local account sees its own college's Local Comelec; anyone else, everybody. An Adviser or
  // Admin reads the list; nothing on it is theirs to decide.
  const local = isLocal(me);
  const viewer = me.readOnly;
  const visibleRequests = (everyRequest ?? []).filter(request => viewer ? canSeeUnit(me, request) : canDecideRequest(me, request));
  const visibleEdits = (edits.value ?? []).filter(edit => edit.subject.affiliation && (viewer ? canSeeUnit(me, { affiliation: edit.subject.affiliation, college: edit.subject.college }) : canDecideRequest(me, { affiliation: edit.subject.affiliation, college: edit.subject.college })));
  const pendingRequest = (edit: { access_request_id: string | null }) => visibleRequests.some(request => request.id === edit.access_request_id);
  // Accounts added by hand stay pending until their first Google sign-in.
  const waitingAccounts = everyAccount.filter(account => canSeeUnit(me, account) && accountStatusOf(account) === "pending");
  const units = local ? (me.college ? [me.college] : []) : [...new Set([...comelecUnits, ...visibleRequests.map(request => request.college)])].sort((a, b) => a.localeCompare(b));
  const unit = typeof unitParam === "string" && ((unitParam === "central" && !local) || units.includes(unitParam)) ? unitParam : undefined;

  const requests = visibleRequests.filter(request => matchesUnit(request, unit));
  const editFor = new Map(visibleEdits.map(edit => [edit.access_request_id, edit]));
  // Edit requests on a request that's already decided still need answering.
  const allLooseEdits = visibleEdits.filter(edit => !pendingRequest(edit));
  const looseEdits = allLooseEdits.filter(edit => matchesUnit({ affiliation: edit.subject.affiliation ?? "central", college: edit.subject.college }, unit));
  const accounts = waitingAccounts.filter(account => matchesUnit(account, unit));
  const manager = viewer ? null : { kind: me.kind, affiliation: me.affiliation, position: me.position, college: me.college };
  const empty = !requests.length && !looseEdits.length && !accounts.length;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Administrative</p>
          <TitleWithInfo info="Everything waiting on the commission before someone can use the portal. Access requests come from Request access on the sign-in page: open one to see its details, then approve it with a position and role, or decline it. They’re emailed either way. Edit requests are changes asked for through Tracking. Accounts added by hand wait here until their first Google sign-in verifies the email.">Approvals</TitleWithInfo>
          {local && <p className="portal-muted">{me.college}</p>}
        </div>
        {viewer ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/accounts/new"><Plus size={16} /> Add account</Link>}
      </header>
      <AccountsTabs current="approvals" showBoardTabs={me.level === FULL_ACCESS} waiting={visibleRequests.length + allLooseEdits.length + waitingAccounts.length} />
      <Notice notice={notice} />

      <div className="portal-filter-rows is-inline">
        <AccountsUnitFilter units={units} value={unit ?? ""} showCentral={!local} />
      </div>

      {edits.error && <p className="portal-form-error" role="alert">{edits.error}</p>}
      {requestsError && (
        <p className="portal-form-error" role="alert">
          Couldn’t load pending access requests. Run <code>supabase/migrations/0016_access_requests.sql</code> in the Supabase SQL Editor, then reload. ({requestsError})
        </p>
      )}

      <section className="portal-card is-flush">
        {empty ? <p className="portal-empty">Nothing waiting. New access requests and edit requests show here.</p> : (
          <div className="portal-table-wrap">
            <table className="portal-table portal-accounts">
              <thead><tr><th>Name</th><th>Student ID</th><th>Affiliation</th><th>Position</th><th>Status</th><th aria-label="Actions" /></tr></thead>
              <tbody key={unit ?? "all"}>
                {requests.map(request => <AccessRequestRow key={request.id} request={request} manager={manager} edit={editFor.get(request.id)} />)}
                {looseEdits.map(edit => <EditRequestRow key={edit.id} edit={edit} readOnly={viewer} />)}
                {accounts.map(account => {
                  const manageable = !viewer && canManageAccount(me, account);
                  const short = account.affiliation === "central" ? "CENTRAL" : account.affiliation === "local" ? (account.college ? (unitAbbreviations[account.college] ?? account.college) : "LOCAL") : "OSA";
                  return (
                    <tr key={account.id}>
                      <td><Link className="portal-row-title" href={`/portal/accounts/${account.id}`}>{listName(account)}</Link></td>
                      <td>{account.kind === "official" ? <span className="portal-muted">Not a student</span> : account.studentNumber ?? <span className="portal-muted">Not set</span>}</td>
                      <td><span title={account.college ?? undefined}>{short}</span></td>
                      <td><div className="portal-account-standing"><AccountKindLabel kind={account.kind} />{account.kind === "personal" && <small className="portal-muted">{positionName(account)}</small>}</div></td>
                      <td><div className="portal-account-status-stack"><AccountStatusLabel status="pending" /><small className="portal-muted">Waiting for first sign-in</small></div></td>
                      <td className="portal-row-actions">{manageable ? <Link href={`/portal/accounts/${account.id}`}><ActionEditIcon size={15} aria-hidden="true" />Manage</Link> : <Link href={`/portal/accounts/${account.id}`}><ActionViewIcon size={15} aria-hidden="true" />View</Link>}</td>
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
