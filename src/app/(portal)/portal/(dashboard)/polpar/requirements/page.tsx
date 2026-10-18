import type { Metadata } from "next";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { requireAccess } from "@/lib/auth/session";
import { listSubmissionStatuses } from "@/lib/party-portal/store";
import { partyRequirements, unitName } from "@/lib/party-portal/types";
import { templateHref } from "@/lib/polpar/content";
import { settle } from "@/lib/portal/settle";
import "@/components/portal/filing-review.css";

/** A requirement's reviews across the applications: only what there is, as dots and words. */
function Counts({ approved, waiting, returned }: { approved: number; waiting: number; returned: number }) {
  if (!approved && !waiting && !returned) return <small>Nothing sent yet</small>;
  return (
    <span className="fr-counts">
      {approved > 0 && <span className="portal-tag is-ok">{approved} approved</span>}
      {waiting > 0 && <span className="portal-tag is-gold">{waiting} to review</span>}
      {returned > 0 && <span className="portal-tag is-warn">{returned} returned</span>}
    </span>
  );
}

export const metadata: Metadata = { title: "Political Party requirements" };

/**
 * What a party files, based on POLPAR Forms 01–07: the same checklist the filing portal shows the
 * party, each with its template, and where each stands across the parties registering or accredited.
 */
export default async function PortalPolParRequirementsPage() {
  const user = await requireAccess("polpar/requirements");
  const local = user.affiliation === "local";
  const { value: statuses, error } = await settle(local && !user.college ? Promise.resolve([]) : listSubmissionStatuses(local ? user.college : null));
  const tally = (id: string, status: string) => (statuses ?? []).filter((item) => item.requirement === id && item.status === status).length;

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Political Party</p>
          <TitleWithInfo info="Every party uploads these in the filing portal, one requirement at a time, and sends each for review. The figures count the parties still registering or accredited. Alumni IDs only apply to a party with active alumni, so they don’t hold up accreditation.">Requirements</TitleWithInfo>
          <p className="portal-muted">Based on POLPAR Forms 01–07{local ? ` · ${unitName(user.college ?? "")}` : ""}</p>
        </div>
        <a className="portal-button is-ghost" href={templateHref("Form 07 - Requirement Checklist.docx")} download>Download Form 07</a>
      </header>
      {error && <p className="portal-form-error" role="alert">Couldn’t count the parties’ documents. Reload the page. ({error})</p>}
      <section className="portal-card is-flush">
        <div className="portal-table-wrap">
          <table className="portal-table fr-table">
            <thead><tr><th>Requirement</th><th>Details</th><th>Template</th><th>Across the parties</th></tr></thead>
            <tbody>
              {partyRequirements.map((item) => (
                <tr key={item.id}>
                  <td><span className="portal-row-title">{item.label}</span>{item.optional && <small>Optional</small>}</td>
                  <td>{item.hint}</td>
                  <td>{item.template ? <a className="fr-template-link" href={templateHref(item.template)} download>Word form</a> : <small>Supporting document</small>}</td>
                  <td><Counts approved={tally(item.id, "approved")} waiting={tally(item.id, "submitted")} returned={tally(item.id, "changes")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
