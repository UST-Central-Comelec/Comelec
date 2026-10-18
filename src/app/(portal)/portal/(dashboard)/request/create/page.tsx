import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/session";
import { comelecUnits } from "@/lib/applications/options";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnly, ViewOnlyTag } from "@/components/portal/view-only";
import { CreateCommissionRequest } from "@/components/portal/commission-request-forms";
import { CommissionRequestList, CommissionRequestLoadError } from "@/components/portal/commission-request-list";
import { commissionRequestsMissing, listCommissionRequests, listCommissionRequestTypes } from "@/lib/portal/commission-requests-store";
import { settle } from "@/lib/portal/settle";
import "@/components/portal/commission-requests.css";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Create Request" };
export default async function CreateRequestPage() {
  const user = await requireAccess("request/create");
  const [types, sent] = await Promise.all([settle(listCommissionRequestTypes()), settle(listCommissionRequests(user, true))]);
  const error = types.error ?? sent.error;
  const submission = crypto.randomUUID();
  return <main className="portal-page is-wide">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Requests</p><TitleWithInfo info="Send a consultation, commissioner request or another configured request type to one Local Comelec unit or all Local units. Each unit receives its own record and answers independently in Approvals. Your sent requests are listed below.">Create Request</TitleWithInfo></div>{user.readOnly && <ViewOnlyTag />}</header>
    {error ? commissionRequestsMissing(error) ? <CommissionRequestLoadError /> : <p className="portal-form-error" role="alert">Couldn’t load requests. Reload the page.</p> : <>
      <ViewOnly when={user.readOnly}><CreateCommissionRequest key={submission} initialSubmission={submission} email={user.email} units={comelecUnits} types={types.value ?? []} /></ViewOnly>
      <section className="portal-card is-flush"><div className="fr-tools"><h2 className="portal-card-title">Sent requests</h2></div><CommissionRequestList requests={sent.value ?? []} sent /></section>
    </>}
  </main>;
}
