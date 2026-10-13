"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AddIcon, SearchIcon } from "@/components/action-icons";
import { surveyNumber, type Survey } from "@/lib/surveys/types";
import { Dropdown } from "./dropdown";
import { TitleWithInfo } from "./info-tip";
import { ViewOnlyTag } from "./view-only";
import { PortalTableRow } from "./portal-table-row";
import "./letters-tracker.css";
import "./surveys.css";

export function SurveysTable({ rows, readOnly, loadError }: { rows: Survey[]; readOnly: boolean; loadError: string | null }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matching = rows.filter(row => (status === "all" || row.status === status) && terms.every(term => `${surveyNumber(row)} ${row.title} ${row.description}`.toLowerCase().includes(term)));
  const pages = Math.max(1, Math.ceil(matching.length / 25));
  const current = Math.min(page, pages - 1);
  const shown = matching.slice(current * 25, (current + 1) * 25);
  return <main className="portal-page is-wide portal-surveys">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Secretariat</p><TitleWithInfo info="Create surveys for portal members, open or close responses, and review the answers collected. Local units see their own college’s surveys. Each signed-in member can answer a survey once.">Surveys</TitleWithInfo></div>{readOnly ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/secretariat/surveys/new"><AddIcon size={16} aria-hidden="true" />Add survey</Link>}</header>
    <section className="portal-card is-flush">
      <div className="portal-table-tools portal-letters-tools">
        <div className="portal-letters-filter"><span className="portal-visually-hidden" id={`${id}-status`}>Status</span><Dropdown labelledBy={`${id}-status`} label="Filter surveys by status" value={status} options={[{ value: "all", label: "All statuses" }, { value: "draft", label: "Draft" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }]} onChange={value => { setStatus(value); setPage(0); }} /></div>
        <label className="portal-search"><span className="portal-visually-hidden">Search surveys</span><SearchIcon size={15} aria-hidden="true" /><input className="portal-input" type="search" value={query} placeholder="Search control number or title" onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      </div>
      {loadError ? <p className="portal-form-error portal-letters-load-error" role="alert">{loadError}</p> : <><div className="portal-table-wrap"><table className="portal-table portal-letters-table"><thead><tr><th>Control Number</th><th>Title</th><th>Status</th><th>Responses</th><th>Date Created</th><th aria-label="Survey details" /></tr></thead><tbody>
        {shown.map(survey => <PortalTableRow key={survey.id} href={`/portal/secretariat/surveys/${survey.id}`}><td className="is-nowrap">{surveyNumber(survey)}</td><td><Link className="portal-row-title" href={`/portal/secretariat/surveys/${survey.id}`}>{survey.title}</Link></td><td><span className={`portal-tag${survey.status === "open" ? " is-ok" : ""}`}>{survey.status === "open" ? "Open" : survey.status === "closed" ? "Closed" : "Draft"}</span></td><td>{survey.responseCount}</td><td className="portal-muted">{new Date(survey.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}</td><td className="portal-row-actions"><Link className="portal-list-review" href={`/portal/secretariat/surveys/${survey.id}`} aria-label={`Open survey ${survey.title}`}><ChevronRight size={18} aria-hidden="true" /></Link></td></PortalTableRow>)}
        {!shown.length && <tr><td colSpan={6}><p className="portal-empty" role="status">{rows.length ? "No surveys match this filter or search." : "No surveys have been added yet."}</p></td></tr>}
      </tbody></table></div><div className="portal-table-foot"><p role="status">{matching.length ? `Showing ${current * 25 + 1}–${current * 25 + shown.length} of ${matching.length}` : "0 surveys"}</p>{pages > 1 && <div className="portal-pager"><button className="portal-button is-small is-ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><button className="portal-button is-small is-ghost" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Next</button></div>}</div></>}
    </section>
  </main>;
}
