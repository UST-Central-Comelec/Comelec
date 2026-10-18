"use client";

import Link from "next/link";
import { useState } from "react";
import type { DocumentProgress } from "@/lib/filing-portal/types";
import type { FilingStageKey, Stage } from "@/lib/filing-portal/tracking";
import { SlidingFilterButtons } from "../sliding-filters";
import { DocumentBar } from "./progress";
import { ListTools, Pager, shortDate, usePaging, useQueryFilter, useSearch } from "./list-tools";

export type FilingRow = {
  id: string;
  reference: string;
  name: string;
  /** Surname first, for sorting. */
  sortName: string;
  email: string;
  studentNumber: string;
  studentCollege: string;
  college: string;
  unit: string;
  position: string;
  council: string;
  partyName: string | null;
  endorsement: string;
  /** Their party is suspended, blacklisted or no longer accredited. */
  partyFlag: boolean;
  stage: Stage & { key: FilingStageKey };
  progress: DocumentProgress;
  /** Documents open to the unit: independent, or endorsed. */
  reachesUnit: boolean;
  lastActivity: string;
  createdAt: string;
};

const stages: Array<{ key: "all" | FilingStageKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "review", label: "Needs review" },
  { key: "returned", label: "Returned" },
  { key: "ready", label: "Ready to decide" },
  { key: "progress", label: "Filing documents" },
  { key: "endorsement", label: "Waiting for the party" },
  { key: "not-endorsed", label: "Not endorsed" },
  { key: "qualified", label: "Qualified" },
  { key: "disqualified", label: "Disqualified" },
  { key: "withdrawn", label: "Withdrawn" },
];
const stageKeys = stages.map((item) => item.key);
const byName = new Intl.Collator("en-PH", { sensitivity: "base" });

/** A unit's certificates of candidacy: where each stands, what comes next, filtered and searched in the browser. */
export function FilingsTable({ rows, showUnits }: { rows: FilingRow[]; showUnits: boolean }) {
  const [stage, setStage] = useQueryFilter("stage", stageKeys);
  const [unit, setUnit] = useState("all");
  const [position, setPosition] = useState("all");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const { query, setQuery, matches } = useSearch();

  const inUnit = rows.filter((row) => (unit === "all" || row.college === unit) && (position === "all" || row.position === position));
  const filtered = inUnit.filter((row) => stage === "all" || row.stage.key === stage);
  const matching = filtered.filter((row) => matches([row.reference, row.name, row.email, row.studentNumber, row.studentCollege, row.position, row.partyName ?? "Independent", row.unit, row.stage.label].join(" ")));
  matching.sort(sort === "name" ? (a, b) => byName.compare(a.sortName, b.sortName) : (a, b) => b.lastActivity.localeCompare(a.lastActivity));
  const { page, pages, shown, setPage } = usePaging(matching, `${stage}:${unit}:${position}:${query}:${sort}`);
  const units = [...new Map(rows.map((row) => [row.college, row.unit])).entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : byName.compare(a, b)));
  const positions = [...new Set(rows.filter((row) => unit === "all" || row.college === unit).map((row) => row.position))];

  return (
    <>
      <ListTools
        filters={stages.map((item) => ({ ...item, count: item.key === "all" ? inUnit.length : inUnit.filter((row) => row.stage.key === item.key).length }))}
        active={stage} onFilter={setStage} filterLabel="Filter filings by where they stand"
        units={showUnits && units.length > 1 ? [{ value: "all", label: "All units" }, ...units.map(([value, label]) => ({ value, label }))] : undefined}
        unit={unit} onUnit={(value) => { setUnit(value); setPosition("all"); }}
        query={query} onQuery={setQuery} searchLabel="Search candidates or IDs"
        sort={sort} onSort={() => setSort(sort === "recent" ? "name" : "recent")} sortLabels={{ recent: "latest activity", name: "surname A–Z" }}
      />
      {positions.length > 1 && (
        <div className="fr-tools">
          <ListPositionFilter positions={positions} value={position} onChange={setPosition} />
        </div>
      )}
      {!shown.length ? <p className="portal-empty" role="status">{filtered.length ? "No candidate matches that search." : rows.length ? "No filing is at this stage." : "No candidacy has been filed yet."}</p> : (
        <div className="portal-table-wrap">
          <table className="portal-table fr-table">
            <thead><tr><th>Candidate</th><th>Running for</th><th>Party</th><th>Documents</th><th>Where it stands</th><th>Last activity</th></tr></thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td><Link className="portal-row-title" href={`/portal/candidacy/filings/${row.id}`}>{row.name}</Link><small>{row.reference} · {row.studentNumber}</small><small>{row.studentCollege}</small></td>
                  <td>{row.position}<small>{row.council}{showUnits ? ` · ${row.unit}` : ""}</small></td>
                  <td>{row.partyName ?? "Independent"}{row.partyName && <small className={row.partyFlag ? "fr-flag" : undefined}>{row.endorsement}</small>}</td>
                  <td>{row.reachesUnit ? <DocumentBar progress={row.progress} /> : <small>Open once the party endorses them</small>}</td>
                  <td><span className={`portal-tag ${row.stage.tone}`}>{row.stage.label}</span><small>{row.stage.next}</small></td>
                  <td><time dateTime={row.lastActivity}>{shortDate(row.lastActivity)}</time><small>Filed {shortDate(row.createdAt)}</small></td>
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

/** The offices filed for, as a second row of filters. */
function ListPositionFilter({ positions, value, onChange }: { positions: string[]; value: string; onChange: (value: string) => void }) {
  return <SlidingFilterButtons items={[{ key: "all", label: "Every position" }, ...positions.map((item) => ({ key: item, label: item }))]} active={value} label="Filter by position" onChange={onChange} />;
}
