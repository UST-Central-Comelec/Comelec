"use client";

import { useState, useTransition } from "react";
import { Check, Search, Trash2, X } from "lucide-react";
import { interestLevels, registrationKinds, type RegistrationKind } from "@/lib/events/options";

/** One person's sign-up, with their answers already in words. */
export type RegistrantRow = {
  id: string;
  name: string;
  email: string;
  studentNumber: string;
  sex: string;
  college: string;
  program: string;
  yearLevel: string;
  organizations: string[];
  interest: number;
  status: RegistrationKind;
  /** "Oct 1, 2026, 9:41 AM", formatted on the server so the browser draws the same text. */
  signedUp: string;
};

const PAGE_SIZE = 25;

type Filter = RegistrationKind | "all";

const interestLabel = (value: number) => interestLevels.find((level) => level.value === value)?.label ?? "";

/** Everything about a row that the search box looks through. */
const searchable = (row: RegistrantRow) => [row.name, row.email, row.studentNumber, row.college, row.program, row.yearLevel, ...row.organizations].join(" ").toLowerCase();

/** The answer to the interest question: as many of five bars lit as the answer, then the number. */
function Interest({ value }: { value: number }) {
  return (
    <span className={`portal-interest portal-level-${value}`} title={interestLabel(value)}>
      <span className="portal-interest-bars" aria-hidden="true">
        {interestLevels.map((level) => <i key={level.value} className={level.value <= value ? "is-lit" : undefined} style={{ height: `${4 + level.value * 2}px` }} />)}
      </span>
      <b>{value}</b>
      <span className="portal-visually-hidden">of 5: {interestLabel(value)}</span>
    </span>
  );
}

/** Two-step removal in the row: the bin arms it, the check confirms. */
function RemoveButton({ name, onRemove }: { name: string; onRemove: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className="portal-icon-button is-light" onClick={() => setArmed(true)} aria-label={`Remove ${name}’s registration`} title="Remove registration"><Trash2 size={14} /></button>
      {armed && (
        <span className="portal-row-remove" role="group" aria-label={`Remove ${name}’s registration?`}>
          <span>{pending ? "Removing…" : "Remove this registration?"}</span>
          <button type="button" className="portal-icon-button is-light" disabled={pending} onClick={() => startTransition(() => onRemove())} aria-label="Yes, remove it" title="Yes, remove"><Check size={14} /></button>
          {/* Focused as it opens: the safe choice is the one under the keyboard. */}
          <button type="button" className="portal-icon-button" disabled={pending} onClick={() => setArmed(false)} aria-label="No, keep it" title="Keep" autoFocus><X size={14} /></button>
        </span>
      )}
    </>
  );
}

/**
 * Everyone who signed up for an event, with the answers they gave: searchable, filtered by whether
 * they registered or are on the waitlist, a page at a time. With `remove` (the unit that manages
 * the event), each row can be removed.
 */
export function RegistrantsTable({ rows, remove }: { rows: RegistrantRow[]; remove?: (registrationId: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const counts = { all: rows.length, registered: rows.filter((row) => row.status === "registered").length, waitlisted: rows.filter((row) => row.status === "waitlisted").length };
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matching = rows.filter((row) => (filter === "all" || row.status === filter) && (terms.length === 0 || terms.every((term) => searchable(row).includes(term))));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  // Removing the last row of the last page, or narrowing the search, can leave the page number past the end.
  const current = Math.min(page, pages - 1);
  const shown = matching.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const show = (next: Filter) => {
    setFilter(next);
    setPage(0);
  };

  return (
    <>
      <div className="portal-table-tools">
        <label className="portal-search">
          <span className="portal-visually-hidden">Search registrants</span>
          <Search size={15} aria-hidden="true" />
          <input className="portal-input" type="search" value={query} placeholder="Search by name, student number, college or organization" autoComplete="off" spellCheck={false} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
        </label>
        {/* Only worth showing when there's a waitlist to tell apart. */}
        {counts.waitlisted > 0 && (
          <div className="portal-filters" role="group" aria-label="Filter by status">
            {(["all", "registered", "waitlisted"] as const).map((value) => (
              <button key={value} type="button" className={filter === value ? "is-active" : undefined} aria-pressed={filter === value} onClick={() => show(value)}>
                {value === "all" ? "Everyone" : registrationKinds[value]}<small>{counts[value]}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="portal-empty" role="status">{rows.length === 0 ? "Nobody has signed up yet. Registrations appear here as they come in." : "No registrants match that search."}</p>
      ) : (
        <div className="portal-table-wrap">
          <table className="portal-table portal-registrants">
            <thead>
              <tr><th>Registrant</th><th>College and program</th><th>Sex</th><th>Organizations</th><th>Interest</th><th>Signed up</th>{remove && <th aria-label="Actions" />}</tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="portal-row-title">{row.name}</span>
                    <small className="portal-muted">{row.studentNumber} · <a href={`mailto:${row.email}`}>{row.email}</a></small>
                  </td>
                  <td>{row.college}<small className="portal-muted">{row.program} · {row.yearLevel}</small></td>
                  <td>{row.sex}</td>
                  <td>
                    {row.organizations.length > 0
                      ? <ul className="portal-orgs">{row.organizations.map((organization) => <li key={organization} title={organization}>{organization}</li>)}</ul>
                      : <span className="portal-muted">None</span>}
                  </td>
                  <td><Interest value={row.interest} /></td>
                  <td className="is-nowrap">
                    <span className={`portal-tag ${row.status === "registered" ? "is-ok" : "is-gold"}`}>{registrationKinds[row.status]}</span>
                    <small className="portal-muted">{row.signedUp}</small>
                  </td>
                  {remove && <td className="portal-row-actions"><RemoveButton name={row.name} onRemove={() => remove(row.id)} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {matching.length > 0 && (
        <div className="portal-table-foot">
          <p role="status">Showing {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + shown.length} of {matching.length}{matching.length !== rows.length ? ` (${rows.length} in all)` : ""}</p>
          {pages > 1 && (
            <div className="portal-pager">
              <button type="button" className="portal-button is-small is-ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
              <button type="button" className="portal-button is-small is-ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
