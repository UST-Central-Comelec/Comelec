import { RequestWorkspace } from "@/components/filing-portal/request-workspace";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { unitName } from "@/lib/party-portal/types";
import { canCancelRequest, requestKinds, type RequestKind } from "@/lib/filing-portal/services";
import { serviceChoices } from "@/lib/filing-portal/service-pages";
import { isServicesMissing, listAccountRequests } from "@/lib/filing-portal/services-store";
import { requireFilingAccount } from "@/lib/filing-portal/session";
import { settle } from "@/lib/portal/settle";

const pages: Record<RequestKind, { info: string; formTitle: string; empty: string }> = {
  consultation: {
    info: "Meet a commissioner about filing a candidacy, registering a party, the campaign or a petition. Pick a time in office hours, Monday to Saturday, a day ahead at least; the unit confirms it with a room or a meeting link, or tells you why it can’t. You can have three requests waiting or coming up at once.",
    formTitle: "Book a consultation",
    empty: "You haven’t booked a consultation.",
  },
  commissioner: {
    info: "Ask your Comelec unit to send a commissioner to an activity: to observe a party’s assembly or its election of officers, to speak at a forum, or to witness an oath. Ask three days ahead at least; the unit confirms who goes, or tells you why it can’t.",
    formTitle: "Request a commissioner",
    empty: "You haven’t asked for a commissioner.",
  },
};

/** Services → Book a consultation, or Request a commissioner: a setter and a records tracker. */
export async function RequestPage({ kind }: { kind: RequestKind }) {
  const filing = await requireFilingAccount();
  const page = pages[kind];
  const [choices, requests] = await Promise.all([serviceChoices(filing), settle(listAccountRequests(filing.account.id, kind))]);
  const list = requests.value ?? [];
  const waiting = list.filter((request) => request.status === "requested").length;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Services · {requestKinds[kind].label}</p>
          <TitleWithInfo info={page.info}>{page.formTitle}</TitleWithInfo>
          <p className="portal-muted">{waiting ? `${waiting} waiting for the unit` : list.length ? `${list.length} asked so far` : "Nothing asked yet"}</p>
        </div>
      </header>
      {requests.error ? (
        <p className="portal-form-error" role="alert">{isServicesMissing(requests.error) ? "Services aren’t set up yet. Try again later, or write to comelec@ust.edu.ph." : "Your requests couldn’t be loaded. Reload the page to try again."}</p>
      ) : (
        <RequestWorkspace key={kind} kind={kind} units={choices.units} behalf={choices.behalf} requests={list} cancellable={list.filter((request) => canCancelRequest(request)).map((request) => request.id)} unitNames={{ ...choices.unitNames, ...Object.fromEntries(list.map((request) => [request.college, unitName(request.college)])) }} empty={page.empty} />
      )}
    </main>
  );
}
