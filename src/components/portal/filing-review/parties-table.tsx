"use client";

import Link from "next/link";
import { useState } from "react";
import type { DocumentProgress } from "@/lib/filing-portal/types";
import type { PartyStageKey, Stage } from "@/lib/filing-portal/tracking";
import { DocumentBar } from "./progress";
import { ListTools, Pager, shortDate, usePaging, useQueryFilter, useSearch } from "./list-tools";

export type PartyRow = {
  id: string;
  reference: string;
  name: string;
  college: string;
  unit: string;
  contactName: string;
  contactEmail: string;
  members: number;
  requests: number;
  candidates: number;
  stage: Stage & { key: PartyStageKey };
  progress: DocumentProgress;
  lastActivity: string;
  createdAt: string;
};

const stages: Array<{ key: "all" | PartyStageKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "review", label: "Needs review" },
  { key: "returned", label: "Returned" },
  { key: "ready", label: "Ready to accredit" },
  { key: "progress", label: "Filing documents" },
  { key: "accredited", label: "Accredited" },
  { key: "declined", label: "Declined" },
  { key: "suspended", label: "Suspended" },
  { key: "blacklisted", label: "Blacklisted" },
  { key: "withdrawn", label: "Withdrawn" },
];
const stageKeys = stages.map((item) => item.key);
const byName = new Intl.Collator("en-PH", { sensitivity: "base" });

/** The parties a unit tracks: where each stands, what comes next, filtered and searched in the browser. */
export function PartiesTable({ rows, showUnits }: { rows: PartyRow[]; showUnits: boolean }) {
  const [stage, setStage] = useQueryFilter("stage", stageKeys);
  const [unit, setUnit] = useState("all");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const { query, setQuery, matches } = useSearch();

  const inUnit = rows.filter((row) => unit === "all" || row.college === unit);
  const filtered = inUnit.filter((row) => stage === "all" || row.stage.key === stage);
  const matching = filtered.filter((row) => matches([row.reference, row.name, row.unit, row.contactName, row.contactEmail, row.stage.label].join(" ")));
  matching.sort(sort === "name" ? (a, b) => byName.compare(a.name, b.name) : (a, b) => b.lastActivity.localeCompare(a.lastActivity));
  const { page, pages, shown, setPage } = usePaging(matching, `${stage}:${unit}:${query}:${sort}`);
  const units = [...new Map(rows.map((row) => [row.college, row.unit])).entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : byName.compare(a, b)));

  return (
    <>
      <ListTools
        filters={stages.map((item) => ({ ...item, count: item.key === "all" ? inUnit.length : inUnit.filter((row) => row.stage.key === item.key).length }))}
        active={stage} onFilter={setStage} filterLabel="Filter parties by where they stand"
        units={showUnits && units.length > 1 ? [{ value: "all", label: "All units" }, ...units.map(([value, label]) => ({ value, label }))] : undefined}
        unit={unit} onUnit={setUnit}
        query={query} onQuery={setQuery} searchLabel="Search parties or IDs"
        sort={sort} onSort={() => setSort(sort === "recent" ? "name" : "recent")} sortLabels={{ recent: "latest activity", name: "name A–Z" }}
      />
      {!shown.length ? <p className="portal-empty" role="status">{filtered.length ? "No party matches that search." : rows.length ? "No party is at this stage." : "No party has registered through the filing portal yet."}</p> : (
        <div className="portal-table-wrap">
          <table className="portal-table fr-table">
            <thead><tr><th>Political party</th>{showUnits && <th>Unit</th>}<th>Documents</th><th>Members</th><th>Where it stands</th><th>Last activity</th></tr></thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td><Link className="portal-row-title" href={`/portal/polpar/registrations/parties/${row.id}`}>{row.name}</Link><small>{row.reference} · {row.contactName ? `Contact: ${row.contactName}` : "No contact person"}</small></td>
                  {showUnits && <td>{row.unit}</td>}
                  <td><DocumentBar progress={row.progress} /></td>
                  <td>{row.members}{row.requests > 0 && <small>{row.requests} asking to join</small>}{row.candidates > 0 && <small>{row.candidates} {row.candidates === 1 ? "candidate" : "candidates"}</small>}</td>
                  <td><span className={`portal-tag ${row.stage.tone}`}>{row.stage.label}</span><small>{row.stage.next}</small></td>
                  <td><time dateTime={row.lastActivity}>{shortDate(row.lastActivity)}</time><small>Registered {shortDate(row.createdAt)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={pages} shown={shown.length} matching={matching.length} total={rows.length} onPage={setPage} />
    </>
  );
}
