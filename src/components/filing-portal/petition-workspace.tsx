"use client";

import { Fragment, useId, useRef, useState } from "react";
import { SearchIcon, ViewIcon } from "@/components/action-icons";
import { PetitionForm, PetitionList, type UnitOption } from "@/components/filing-portal/services";
import { Dropdown } from "@/components/portal/dropdown";
import { SlidingFilterButtons } from "@/components/portal/sliding-filters";
import { petitionStatusLabel, petitionStatusTone, petitionTypes, type Petition } from "@/lib/filing-portal/services";
import { scrollToElement } from "@/lib/scroll";
import "./request-workspace.css";

type Props = {
  units: UnitOption[];
  draftKey: string;
  petitions: Petition[];
  unitNames: Record<string, string>;
};

const when = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

/** Keep the form and its draft mounted while the filer checks their petition records. */
export function PetitionWorkspace({ units, draftKey, ...records }: Props) {
  const [view, setView] = useState<"form" | "records">("form");
  const container = useRef<HTMLDivElement>(null);
  return (
    <div ref={container} className="pp-request-workspace">
      <SlidingFilterButtons
        label="Petition views"
        active={view}
        items={[{ key: "form", label: "File a petition" }, { key: "records", label: "Records" }]}
        onChange={(next) => {
          setView(next);
          if (container.current) scrollToElement(container.current, { smooth: true });
        }}
      />
      <section hidden={view !== "form"} aria-label="File a petition">
        <PetitionForm units={units} draftKey={draftKey} />
      </section>
      <section hidden={view !== "records"} aria-label="Petition records">
        <PetitionRecords {...records} />
      </section>
    </div>
  );
}

function PetitionRecords({ petitions, unitNames }: Pick<Props, "petitions" | "unitNames">) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [opened, setOpened] = useState<string | null>(null);
  const search = query.trim().toLocaleLowerCase();
  const matching = petitions.filter((petition) => (!status || petition.status === status) &&
    [petition.reference, petition.subject, petitionTypes[petition.type].label, unitNames[petition.college] ?? petition.college, petition.respondent, petitionStatusLabel[petition.status]]
      .some((value) => value?.toLocaleLowerCase().includes(search)));

  return (
    <div className="portal-card is-flush">
      <div className="portal-table-tools pp-request-tools">
        <div className="pp-request-status">
          <Dropdown value={status} onChange={setStatus} label="Filter by status" options={[{ value: "", label: "All statuses" }, ...Object.entries(petitionStatusLabel).map(([value, label]) => ({ value, label }))]} />
        </div>
        <label className="portal-search">
          <SearchIcon size={16} aria-hidden="true" />
          <input type="search" className="portal-input" aria-label="Search petition records" placeholder="Search reference, subject or unit…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <div className="portal-table-wrap" role="region" aria-label="Petition records table" tabIndex={0}>
        <table className="portal-table pp-request-table">
          <thead><tr><th scope="col">Reference</th><th scope="col">Subject</th><th scope="col">Filed</th><th scope="col">Status</th><th scope="col" aria-label="Details" /></tr></thead>
          <tbody>
            {matching.map((petition) => {
              const expanded = opened === petition.id;
              return (
                <Fragment key={petition.id}>
                  <tr>
                    <td className="is-nowrap">{petition.reference}</td>
                    <td><strong>{petition.subject}</strong><small>{unitNames[petition.college] ?? petition.college} · {petitionTypes[petition.type].label}</small></td>
                    <td>{when(petition.createdAt)}</td>
                    <td><span className={`portal-tag ${petitionStatusTone[petition.status]}`}>{petitionStatusLabel[petition.status]}</span></td>
                    <td className="portal-row-actions"><button type="button" className="portal-icon-button" aria-label={`View petition ${petition.reference}`} aria-expanded={expanded} aria-controls={`${id}-${petition.id}`} onClick={() => setOpened(expanded ? null : petition.id)}><ViewIcon size={16} aria-hidden="true" /></button></td>
                  </tr>
                  <tr hidden={!expanded} className="pp-request-detail-row"><td colSpan={5} id={`${id}-${petition.id}`}>
                    {expanded && <PetitionList petitions={[petition]} unitNames={unitNames} />}
                  </td></tr>
                </Fragment>
              );
            })}
            {!matching.length && <tr><td colSpan={5}><p className="portal-empty" role="status">{petitions.length ? "No petitions match your search or status." : "You haven’t filed a petition."}</p></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="portal-table-foot"><p role="status">{matching.length} of {petitions.length} petition{petitions.length === 1 ? "" : "s"}</p></div>
    </div>
  );
}
