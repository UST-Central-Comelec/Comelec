"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Clock } from "lucide-react";
import { SearchIcon } from "@/components/action-icons";
import { Dropdown, type DropdownOption } from "../dropdown";
import { SlidingFilterButtons } from "../sliding-filters";
import "../filing-review.css";

// What the Applicants lists share: filters held in the address (so a filtered list can be linked
// to and survives a reload), a unit picker for the Central Comelec, search, the sort switch, and
// paging.

export const PAGE_SIZE = 25;

/** A filter kept in the query string as `key`; the first of `allowed` is the default and leaves the address clean. */
export function useQueryFilter<Key extends string>(key: string, allowed: readonly Key[]): [Key, (value: Key) => void] {
  const searchParams = useSearchParams();
  const raw = searchParams.get(key);
  const value = (allowed as readonly string[]).includes(raw ?? "") ? (raw as Key) : allowed[0];
  const set = (next: Key) => {
    const url = new URL(window.location.href);
    if (next === allowed[0]) url.searchParams.delete(key);
    else url.searchParams.set(key, next);
    if (url.href !== window.location.href) window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  return [value, set];
}

/** A free-text filter of rows: every word typed is somewhere in the row's text. */
export function useSearch() {
  const [query, setQuery] = useState("");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return { query, setQuery, matches: (text: string) => { const haystack = text.toLowerCase(); return terms.every((term) => haystack.includes(term)); } };
}

export function ListTools<Key extends string>({ filters, active, onFilter, filterLabel, units, unit, onUnit, query, onQuery, searchLabel, sort, onSort, sortLabels }: {
  filters: Array<{ key: Key; label: string; count: number }>;
  active: Key;
  onFilter: (key: Key) => void;
  filterLabel: string;
  /** The Central Comelec's picker of units; left out for a Local unit. */
  units?: DropdownOption[];
  unit?: string;
  onUnit?: (value: string) => void;
  query: string;
  onQuery: (value: string) => void;
  searchLabel: string;
  sort: "recent" | "name";
  onSort: () => void;
  sortLabels: { recent: string; name: string };
}) {
  return (
    <div className="fr-tools">
      <SlidingFilterButtons items={filters.filter((item) => item.count > 0 || item.key === active || item.key === filters[0].key).map((item) => ({ key: item.key, label: <>{item.label}<small>{item.count}</small></> as ReactNode }))} active={active} label={filterLabel} onChange={onFilter} />
      <div className="fr-tools-side">
        {units && onUnit && <Dropdown size="pill" label="Show unit" value={unit ?? ""} onChange={onUnit} options={units} />}
        <label className="portal-search">
          <span className="portal-visually-hidden">{searchLabel}</span>
          <SearchIcon size={15} aria-hidden="true" />
          <input className="portal-input" type="search" value={query} placeholder={`${searchLabel}…`} autoComplete="off" spellCheck={false} onChange={(event) => onQuery(event.target.value)} />
        </label>
        <button type="button" className="portal-icon-button portal-applicant-sort" aria-pressed={sort === "name"} onClick={onSort}
          aria-label={sort === "recent" ? `Sorted by ${sortLabels.recent}. Switch to ${sortLabels.name}` : `Sorted by ${sortLabels.name}. Switch to ${sortLabels.recent}`}
          title={sort === "recent" ? `${sortLabels.recent} · Switch to ${sortLabels.name}` : `${sortLabels.name} · Switch to ${sortLabels.recent}`}>
          {sort === "recent" ? <Clock size={15} aria-hidden="true" /> : <span className="portal-applicant-sort-letter" aria-hidden="true">A</span>}
        </button>
      </div>
    </div>
  );
}

/** "Showing 1–25 of 60", and Previous and Next when there's more than a page. */
export function Pager({ page, pages, shown, matching, total, onPage }: { page: number; pages: number; shown: number; matching: number; total: number; onPage: (page: number) => void }) {
  if (!matching) return null;
  return (
    <div className="portal-table-foot">
      <p role="status">Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + shown} of {matching}{matching !== total ? ` (${total} in all)` : ""}</p>
      {pages > 1 && (
        <div className="portal-pager">
          <button type="button" className="portal-button is-small is-ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
          <button type="button" className="portal-button is-small is-ghost" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

/** Paging that goes back to the first page whenever the filters change. */
export function usePaging<T>(rows: T[], filterKey: string) {
  const [state, setState] = useState({ filterKey, page: 0 });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(state.filterKey === filterKey ? state.page : 0, pages - 1);
  return { page, pages, shown: rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), setPage: (next: number) => setState({ filterKey, page: next }) };
}

const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
export const shortDate = (iso: string) => (iso ? dateFormat.format(new Date(iso)) : "");
