import type { Metadata } from "next";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { CommissionRequestTypeForm } from "@/components/portal/commission-request-forms";
import { CommissionRequestLoadError } from "@/components/portal/commission-request-list";
import { requireAccess } from "@/lib/auth/session";
import { commissionRequestsMissing, listCommissionRequestTypes } from "@/lib/portal/commission-requests-store";
import { settle } from "@/lib/portal/settle";
import "@/components/portal/commission-requests.css";

export const metadata: Metadata = { title: "Request settings" };
export default async function RequestSettingsPage() {
  const user = await requireAccess("request/settings");
  const types = await settle(listCommissionRequestTypes());
  const readOnly = user.readOnly || user.affiliation !== "central";
  return <main className="portal-page">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Requests</p><TitleWithInfo info="Add or rename the types offered under Create Request. Switch a type off to stop new requests using it. Existing records keep the type name they were sent with. Only the Central Comelec manages this list; the public filing portal’s service types retain their Elections Code rules.">Settings</TitleWithInfo></div>{readOnly && <ViewOnlyTag />}</header>
    {types.error ? commissionRequestsMissing(types.error) ? <CommissionRequestLoadError /> : <p className="portal-form-error" role="alert">Couldn’t load request types. Reload the page.</p> : <div className="cr-type-list">
      {(types.value ?? []).map(type => <CommissionRequestTypeForm key={`${type.id}:${type.updated_at}`} type={type} readOnly={readOnly} />)}
      {!readOnly && <CommissionRequestTypeForm />}
    </div>}
  </main>;
}
