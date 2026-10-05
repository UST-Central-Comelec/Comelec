import Link from "next/link";
import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth/session";
import { formatClosing } from "@/lib/applications/period";
import { getPartyRegistration } from "@/lib/polpar/store";
import { requirements, rosterSections } from "@/lib/polpar/content";
import { PartyReviewForm } from "@/components/polpar/review-form";
import { SavedPdfDownloads } from "@/components/polpar/pdf-downloads";

export const metadata: Metadata = { title: "Party registration details" };
export default async function PartyRegistrationDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("polpar/registrations");
  const record = await getPartyRegistration((await params).id);
  const data = record.payload;
  const details = [["Commission unit", record.college || "Central Comelec"], ["Established", data.establishedAt], ["Principal headquarters", data.headquarters || "Not specified"], ["Contact person", data.contactPerson], ["Contact number", data.contactNumber], ["Email", data.email], ["Petition date", data.petitionDate], ["Petition signatory", `${data.petitionSignatory.fullName} · ${data.petitionSignatory.position}`], ["Submitted by", `${data.submittedBy} · ${data.submittedPosition}`], ["Received online", formatClosing(record.created_at)]];
  return <main className="portal-page">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Political Party · {record.reference}</p><h1>{record.party_name}</h1></div><Link className="portal-button is-ghost" href="/portal/polpar/registrations">All registrations</Link></header>
    <section className="portal-card"><h2>Party information and petition</h2><dl className="portal-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="portal-muted">The filer confirmed the petition declaration, roster certifications, and signed conforme requirements when submitting.</p></section>
    <section className="portal-card"><h2>Filled PDF forms</h2><p className="portal-muted">Regenerate the applicant’s forms from the saved entries. These copies have blank signature and Commission certification lines; signed originals are under Submitted documents.</p><SavedPdfDownloads data={data} /></section>
    {rosterSections.map((section) => <section className="portal-card" key={section.id}><h2>{section.title} · {data[section.id].length}</h2>{data[section.id].length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr>{section.fields.map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{data[section.id].map((row, index) => <tr key={index}>{section.fields.map((field) => <td key={field.key}>{(row as Record<string, string>)[field.key]}</td>)}</tr>)}</tbody></table></div> : <p className="portal-muted">No entries declared. Refer to the submitted form.</p>}<p className="portal-muted">Certified by {data.certifications[section.id].fullName} · {data.certifications[section.id].position}</p></section>)}
    <section className="portal-card"><h2>Submitted documents</h2><div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Requirement</th><th>Document</th><th>Size</th></tr></thead><tbody>{record.documents.map((document, index) => <tr key={document.path}><td>{requirements.find((item) => item.id === document.requirement)?.label ?? document.requirement}</td><td><a href={`/portal/polpar/registrations/${record.id}/documents/${index}`} target="_blank" rel="noopener noreferrer">{document.name}</a></td><td>{(document.size / 1024 / 1024).toFixed(2)} MB</td></tr>)}</tbody></table></div></section>
    <section className="portal-card"><h2>Commission use only · Form 07</h2><p className="portal-muted">Record receipt and completeness against the submitted documents. This checklist does not itself grant recognition.</p><PartyReviewForm id={record.id} review={record.review} readOnly={user.readOnly} />{record.reviewed_at && <p className="portal-muted">Last updated by {record.reviewed_by} · {formatClosing(record.reviewed_at)}</p>}</section>
  </main>;
}
