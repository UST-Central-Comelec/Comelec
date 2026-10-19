import type { Metadata } from "next";
import Link from "next/link";
import { AddIcon as Plus } from "@/components/action-icons";
import { AccountKindLabel, AccountStatusLabel } from "@/components/portal/account-badges";
import { AccessRequestRow } from "@/components/portal/access-requests";
import { AccountsTabs } from "@/components/portal/accounts-tabs";
import { AccountsUnitFilter } from "@/components/portal/accounts-unit-filter";
import { AccountReviewChevron, AccountReviewLink, AccountReviewRow } from "@/components/portal/account-review-row";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { getAccessRequest, listPendingAccessRequests } from "@/lib/access-requests/admin";
import { listSubmissionEditHistory, listSubmissionEditReviews } from "@/lib/applications/edit-requests";
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
  const { notice, unit: unitParam, kind: kindParam } = await searchParams;
  const category = kindParam === "personal" || kindParam === "official" ? kindParam : undefined;
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

  const unitRequests = visibleRequests.filter(request => matchesUnit(request, unit));
  const requests = category === "official" ? [] : unitRequests;
  const editFor = new Map(visibleEdits.map(edit => [edit.access_request_id, edit]));
  // Edit requests on a request that's already decided still need answering.
  const allLooseEdits = visibleEdits.filter(edit => !pendingRequest(edit));
  const unitEdits = allLooseEdits.filter(edit => matchesUnit({ affiliation: edit.subject.affiliation ?? "central", college: edit.subject.college }, unit));
  const looseEdits = category === "official" ? [] : unitEdits;
  const unitAccounts = waitingAccounts.filter(account => matchesUnit(account, unit));
  const accounts = unitAccounts.filter(account => !category || account.kind === category);
  const categoryHref = (kind?: "personal" | "official") => {
    const params = new URLSearchParams();
    if (unit) params.set("unit", unit);
    if (kind) params.set("kind", kind);
    return `/portal/accounts/approvals${params.size ? `?${params}` : ""}`;
  };
  const manager = viewer ? null : { kind: me.kind, affiliation: me.affiliation, position: me.position, college: me.college };
  const [history, decidedRequests] = await Promise.all([
    settle(listSubmissionEditHistory("access", [...new Set([...requests.map(request => request.id), ...looseEdits.flatMap(edit => edit.access_request_id ? [edit.access_request_id] : [])])])),
    Promise.all(looseEdits.map(async edit => ({ edit, request: edit.access_request_id ? await getAccessRequest(edit.access_request_id) : null }))),
  ]);
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
        <SlidingFilters label="Filter approvals by category" active={category ?? "all"} items={[
          { key: "all", href: categoryHref(), label: "All approvals" },
          { key: "personal", href: categoryHref("personal"), label: <>Commissioner<small>{unitRequests.length + unitEdits.length + unitAccounts.filter(account => account.kind === "personal").length}</small></> },
          { key: "official", href: categoryHref("official"), label: <>Official accounts<small>{unitAccounts.filter(account => account.kind === "official").length}</small></> },
        ]} />
      </div>

      {edits.error && <p className="portal-form-error" role="alert">{edits.error}</p>}
      {requestsError && (
        <p className="portal-form-error" role="alert">
          Couldn’t load pending access requests. Run <code>supabase/migrations/0016_access_requests.sql</code> in the Supabase SQL Editor, then reload. ({requestsError})
        </p>
      )}

      <section className="portal-card is-flush">
        {empty ? <p className="portal-empty">{category === "official" ? "No official accounts waiting for verification." : category === "personal" ? "No commissioner approvals waiting." : "Nothing waiting. New access requests and edit requests show here."}</p> : (
          <div className="portal-table-wrap">
            <table className="portal-table portal-accounts">
              <thead><tr><th>Name</th><th>Student ID</th><th>Affiliation</th><th>Position</th><th>Status</th><th aria-label="Actions" /></tr></thead>
              <tbody key={unit ?? "all"}>
                {requests.map(request => <AccessRequestRow key={request.id} request={request} manager={manager} edit={editFor.get(request.id)} history={history.value?.filter(edit => edit.access_request_id === request.id)} historyError={history.error ?? undefined} />)}
                {decidedRequests.map(({ edit, request }) => request && (viewer ? canSeeUnit(me, request) : canDecideRequest(me, request)) && <AccessRequestRow key={edit.id} request={request} manager={manager} edit={edit} history={history.value?.filter(item => item.access_request_id === request.id)} historyError={history.error ?? undefined} />)}
                {accounts.map(account => {
                  const manageable = !viewer && canManageAccount(me, account);
                  const short = account.affiliation === "central" ? "CENTRAL" : account.affiliation === "local" ? (account.college ? (unitAbbreviations[account.college] ?? account.college) : "LOCAL") : "OSA";
                  return (
                    <AccountReviewRow key={account.id} href={manageable || viewer ? `/portal/accounts/${account.id}/review` : undefined}>
                      <td>{manageable || viewer ? <AccountReviewLink href={`/portal/accounts/${account.id}/review`}>{listName(account)}</AccountReviewLink> : <span className="portal-row-title">{listName(account)}</span>}</td>
                      <td>{account.kind === "official" ? <span className="portal-muted">Not a student</span> : account.studentNumber ?? <span className="portal-muted">Not set</span>}</td>
                      <td><span title={account.college ?? undefined}>{short}</span></td>
                      <td><div className="portal-account-standing"><AccountKindLabel kind={account.kind} />{account.kind === "personal" && <small className="portal-muted">{positionName(account)}</small>}</div></td>
                      <td><div className="portal-account-status-stack"><AccountStatusLabel status="pending" /><small className="portal-muted">Waiting for first sign-in</small></div></td>
                      <td className="portal-row-actions">{(manageable || viewer) && <AccountReviewChevron href={`/portal/accounts/${account.id}/review`} name={listName(account)} />}</td>
                    </AccountReviewRow>
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
