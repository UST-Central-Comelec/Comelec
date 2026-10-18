"use client";

import Link from "next/link";
import { useState } from "react";
import { ListTools, Pager, shortDate, usePaging, useQueryFilter, useSearch } from "./list-tools";

export type AccountRow = {
  id: string;
  name: string;
  sortName: string;
  email: string;
  studentNumber: string;
  mobileNumber: string;
  college: string;
  party: { name: string; detail: string; tone: string } | null;
  candidacy: { position: string; detail: string; tone: string } | null;
  suspended: boolean;
  createdAt: string;
};

const views = [
  { key: "all", label: "All" },
  { key: "party", label: "In a party" },
  { key: "candidates", label: "Candidates" },
  { key: "both", label: "Party and candidacy" },
  { key: "none", label: "Nothing open" },
  { key: "suspended", label: "Suspended" },
] as const;
type View = (typeof views)[number]["key"];
const viewKeys = views.map((item) => item.key);
const byName = new Intl.Collator("en-PH", { sensitivity: "base" });

const inView = (row: AccountRow, view: View) =>
  view === "all" ? true
    : view === "party" ? row.party !== null
      : view === "candidates" ? row.candidacy !== null
        : view === "both" ? row.party !== null && row.candidacy !== null
          : view === "none" ? row.party === null && row.candidacy === null
            : row.suspended;

/** The filing portal's accounts a unit may see: who they are, their party and candidacy, and whether they can sign in. */
export function AccountsTable({ rows, base }: { rows: AccountRow[]; /** "/portal/polpar/registrations" or the candidacy one: where each account opens. */ base: string }) {
  const [view, setView] = useQueryFilter<View>("view", viewKeys);
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const { query, setQuery, matches } = useSearch();
  const filtered = rows.filter((row) => inView(row, view));
  const matching = filtered.filter((row) => matches([row.name, row.email, row.studentNumber, row.mobileNumber, row.college, row.party?.name ?? "", row.candidacy?.position ?? ""].join(" ")));
  matching.sort(sort === "name" ? (a, b) => byName.compare(a.sortName, b.sortName) : (a, b) => b.createdAt.localeCompare(a.createdAt));
  const { page, pages, shown, setPage } = usePaging(matching, `${view}:${query}:${sort}`);

  return (
    <>
      <ListTools
        filters={views.map((item) => ({ ...item, count: rows.filter((row) => inView(row, item.key)).length }))}
        active={view} onFilter={setView} filterLabel="Filter accounts"
        query={query} onQuery={setQuery} searchLabel="Search accounts"
        sort={sort} onSort={() => setSort(sort === "recent" ? "name" : "recent")} sortLabels={{ recent: "newest first", name: "surname A–Z" }}
      />
      {!shown.length ? <p className="portal-empty" role="status">{filtered.length ? "No account matches that search." : rows.length ? "No account here." : "Nobody has signed up to the filing portal yet."}</p> : (
        <div className="portal-table-wrap">
          <table className="portal-table fr-table">
            <thead><tr><th>Name</th><th>Student</th><th>Political party</th><th>Candidacy</th><th>Access</th><th>Signed up</th></tr></thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td><Link className="portal-row-title" href={`${base}/accounts/${row.id}`}>{row.name}</Link><small>{row.email}</small></td>
                  <td>{row.studentNumber}<small>{row.college}</small></td>
                  <td>{row.party ? <>{row.party.name}<small><span className={`portal-tag ${row.party.tone}`}>{row.party.detail}</span></small></> : <small>None</small>}</td>
                  <td>{row.candidacy ? <>{row.candidacy.position}<small><span className={`portal-tag ${row.candidacy.tone}`}>{row.candidacy.detail}</span></small></> : <small>None</small>}</td>
                  <td><span className={`portal-tag${row.suspended ? " is-danger" : " is-ok"}`}>{row.suspended ? "Suspended" : "Can sign in"}</span></td>
                  <td><time dateTime={row.createdAt}>{shortDate(row.createdAt)}</time></td>
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
