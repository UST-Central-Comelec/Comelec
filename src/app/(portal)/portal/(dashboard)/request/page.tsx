import type { Metadata } from "next";
import Link from "next/link";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { requireAccess } from "@/lib/auth/session";
import { formatSlot, isOpenRequest, requestKinds, requestModes, requestStatusLabel, requestStatusTone, topicLabel } from "@/lib/filing-portal/services";
import { isServicesMissing, listRequestsForUnit, type RequestRow } from "@/lib/filing-portal/services-store";
import { fullName } from "@/lib/filing-portal/types";
import { unitName } from "@/lib/party-portal/types";
import { settle } from "@/lib/portal/settle";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Requests" };

const views = { waiting: "Waiting for you", upcoming: "Confirmed", past: "Past", all: "All" } as const;
type View = keyof typeof views;
const isView = (value: unknown): value is View => typeof value === "string" && Object.hasOwn(views, value);

const inView = (view: View, request: RequestRow, now = Date.now()) =>
  view === "all" || (view === "waiting" ? request.status === "requested" : view === "upcoming" ? request.status === "confirmed" && isOpenRequest(request, now) : request.status !== "requested" && !(request.status === "confirmed" && isOpenRequest(request, now)));

/**
 * Request: what the filing portal's accounts ask of the unit. Consultations booked with it, and
 * commissioners asked for at activities, to confirm with a time, a place and who goes, or to
 * decline. A Local unit sees what's addressed to its own college.
 */
export default async function PortalRequestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAccess("request");
  const local = user.affiliation === "local";
  const { show } = await searchParams;
  const view: View = isView(show) ? show : "waiting";
  const { value, error } = await settle(local && !user.college ? Promise.resolve([]) : listRequestsForUnit(local ? user.college : null));
  const all = value ?? [];
  const rows = all.filter((request) => inView(view, request)).sort((a, b) => view === "waiting" || view === "upcoming" ? Date.parse(a.confirmedStart ?? a.startsAt) - Date.parse(b.confirmedStart ?? b.startsAt) : b.createdAt.localeCompare(a.createdAt));
  const count = (key: View) => all.filter((request) => inView(key, request)).length;

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Portal</p>
          <TitleWithInfo info="Consultations booked in the filing portal, and commissioners asked for at activities (a party’s assembly, a forum, an oath). Open one to confirm it with a time, a place and who goes, or to decline it with a reason. The filer is notified and emailed either way. Each has its own BC- or RC- ID.">Requests</TitleWithInfo>
          <p className="portal-muted">{local ? unitName(user.college ?? "") : "Every unit’s requests"}</p>
        </div>
      </header>
      {error ? <p className="portal-form-error" role="alert">{isServicesMissing(error) ? "Requests need a database update first: apply supabase/migrations/20261018200000_filing_services_campaign.sql, then reload." : `Couldn’t load the requests. Reload the page. (${error})`}</p> : (
        <>
          <dl className="portal-kpis fr-kpis">
            <div className="is-lead"><dt>Waiting for you</dt><dd>{count("waiting")}</dd></div>
            <div><dt>Confirmed, coming up</dt><dd>{count("upcoming")}</dd></div>
            <div><dt>Consultations</dt><dd>{all.filter((request) => request.kind === "consultation").length}</dd></div>
            <div><dt>Commissioner requests</dt><dd>{all.filter((request) => request.kind === "commissioner").length}</dd></div>
          </dl>
          <section className="portal-card is-flush">
            <div className="fr-tools">
              <SlidingFilters label="Requests" active={view} items={(Object.keys(views) as View[]).map((key) => ({ key, href: key === "waiting" ? "/portal/request" : `/portal/request?show=${key}`, label: <>{views[key]} <small>{count(key)}</small></> }))} />
            </div>
            {rows.length ? (
              <div className="portal-table-wrap">
                <table className="portal-table fr-table">
                  <thead><tr><th>Request</th><th>From</th><th>Asked for</th>{!local && <th>Unit</th>}<th>Status</th></tr></thead>
                  <tbody>
                    {rows.map((request) => (
                      <tr key={request.id}>
                        <td><Link className="portal-row-title" href={`/portal/request/${request.id}`}>{request.subject}</Link><small className="fr-sub">{request.reference} · {requestKinds[request.kind].noun[0].toUpperCase() + requestKinds[request.kind].noun.slice(1)} · {topicLabel(request)}</small></td>
                        <td>{fullName(request.account)}<small className="fr-sub">{request.partyName && request.onBehalf === "party" ? `For ${request.partyName}` : request.account.email}</small></td>
                        <td><time>{formatSlot(request.confirmedStart ?? request.startsAt, request.confirmedEnd ?? request.endsAt)}</time><small className="fr-sub">{requestModes[request.mode]}{request.venue ? ` · ${request.venue}` : ""}</small></td>
                        {!local && <td>{unitName(request.college)}</td>}
                        <td><span className={`portal-tag ${requestStatusTone[request.status]}`}>{request.status === "requested" ? "Waiting for you" : requestStatusLabel[request.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="portal-empty">{view === "waiting" ? "Nothing waiting. New requests from the filing portal show up here." : "Nothing here."}</p>}
          </section>
        </>
      )}
    </main>
  );
}
