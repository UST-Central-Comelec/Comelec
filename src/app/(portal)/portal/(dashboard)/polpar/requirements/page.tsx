import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/session";
import { requirements, templateHref } from "@/lib/polpar/content";

export const metadata: Metadata = { title: "Political Party requirements" };

export default async function PortalPolParRequirementsPage() {
  await requireAccess("polpar/requirements");
  return <main className="portal-page"><header className="portal-page-head"><div><p className="portal-eyebrow">Political Party</p><h1>Registration requirements</h1><p className="portal-muted">Based on POLPAR Forms 01–07. The public registration form uses this same checklist.</p></div><a className="portal-button is-ghost" href={templateHref("Form 07 - Requirement Checklist.docx")} download>Download Form 07</a></header><section className="portal-card is-flush"><div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Requirement</th><th>Details</th><th>Template</th></tr></thead><tbody>{requirements.map((item) => <tr key={item.id}><td>{item.label}</td><td>{item.hint}</td><td>{"template" in item ? <a href={templateHref(item.template)} download>Download Word form</a> : "Supporting document"}</td></tr>)}</tbody></table></div></section></main>;
}
