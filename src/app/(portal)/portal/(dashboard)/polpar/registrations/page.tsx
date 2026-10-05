import type { Metadata } from "next";
import Link from "next/link";
import { requireAccess } from "@/lib/auth/session";
import { listPartyRegistrations } from "@/lib/polpar/store";
import { settle } from "@/lib/portal/settle";
import { formatClosing } from "@/lib/applications/period";

export const metadata: Metadata = { title: "Party registrations" };

export default async function PortalPartyRegistrationsPage() {
  const user = await requireAccess("polpar/registrations");
  const { value: registrations, error } = await settle(listPartyRegistrations());
  return <main className="portal-page">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Political Party</p><h1>Registrations</h1><p className="portal-muted">{user.affiliation === "local" ? user.college : "Central and Local Commission registrations"} · Latest 500 submissions</p></div><Link className="portal-button is-ghost" href="/party-registration" target="_blank">View registration form</Link></header>
    {error ? <p className="portal-form-error" role="alert">{error}</p> : <section className="portal-card is-flush">{!registrations?.length ? <p className="portal-empty">No political party registrations have been submitted yet.</p> : <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Political party</th><th>Commission unit</th><th>Contact email</th><th>Submitted</th><th>Review</th></tr></thead><tbody>{registrations.map((row) => <tr key={row.id}><td><Link className="portal-row-title" href={`/portal/polpar/registrations/${row.id}`}>{row.party_name}</Link><small className="portal-muted">{row.reference}</small></td><td>{row.college || "Central Comelec"}</td><td>{row.email}</td><td>{formatClosing(row.created_at)}</td><td><Link href={`/portal/polpar/registrations/${row.id}`}>Open application</Link></td></tr>)}</tbody></table></div>}</section>}
  </main>;
}
