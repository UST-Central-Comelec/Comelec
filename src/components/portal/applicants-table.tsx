"use client";

import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidingFilterButtons } from "./sliding-filters";
import { applicationStatuses, isApplicationStatus, type ApplicationStatus } from "@/lib/applications/status";
import { preferredBodies } from "@/lib/applications/options";
import { ChevronRight, Clock, Search } from "lucide-react";
import { applicantDisplayName } from "@/lib/applications/name";
import { ApplicationModal } from "./application-modal";
import { ApplicationDetailsView } from "./application-details-view";
import type { ApplicationRecord } from "@/lib/applications/admin";
import type { UnitSlotCounts } from "@/lib/applications/options";

export type ApplicantRow = {
  id: string;
  application: ApplicationRecord;
  name: string;
  position: string;
  college: string;
  collegeAbbreviation: string;
  statusLabel: string;
  statusTone: string;
};

const PAGE_SIZE = 25;
const nameOrder = new Intl.Collator("en-PH", { sensitivity: "base" });
const submissionDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
const submissionTime = new Intl.DateTimeFormat("en-PH", { timeStyle: "short", timeZone: "Asia/Manila" });

function newestFirst(a: ApplicantRow, b: ApplicantRow) {
  return Date.parse(b.application.submittedAt) - Date.parse(a.application.submittedAt) || a.id.localeCompare(b.id);
}

function alphabetical(a: ApplicantRow, b: ApplicantRow) {
  return nameOrder.compare(a.application.lastName, b.application.lastName)
    || nameOrder.compare(a.application.firstName, b.application.firstName)
    || nameOrder.compare(a.application.middleName, b.application.middleName)
    || newestFirst(a, b);
}
const statusFilters: { key: ApplicationStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: applicationStatuses.pending },
  { key: "accepted", label: applicationStatuses.accepted },
  { key: "declined", label: applicationStatuses.declined },
];
const bodyFilters: { key: keyof typeof preferredBodies | "all"; label: string }[] = [
  { key: "central", label: "Central Comelec" },
  { key: "local", label: "Local Comelec" },
  { key: "all", label: "All bodies" },
];

export function ApplicantsTable({ rows, localCollege, slots, readOnly, canOnboard }: {
  rows: ApplicantRow[];
  localCollege: string | null;
  slots: UnitSlotCounts | null;
  readOnly: boolean;
  canOnboard: boolean;
}) {
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const status = isApplicationStatus(statusParam) ? statusParam : "all";
  const bodyParam = searchParams.get("body");
  const body = bodyParam === "local" || bodyParam === "all" ? bodyParam : "central";
  const filterKey = `${localCollege === null ? body : "college"}:${status}`;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"time" | "name">("time");
  const [pagination, setPagination] = useState({ filterKey, page: 0 });
  const page = pagination.filterKey === filterKey ? pagination.page : 0;
  const setPage = (page: number) => setPagination({ filterKey, page });
  const reviewId = searchParams.get("application");
  const reviewTitleId = useId();
  const review = rows.find((row) => row.id === reviewId);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const filteredRows = rows.filter((row) =>
    (status === "all" || row.application.status === status) &&
    (localCollege !== null || body === "all" || row.application.preferredBodyId === body)
  );
  const emptyMessage = `${status === "all" ? "No applications yet" : `No applications marked “${applicationStatuses[status]}”`}${localCollege !== null ? ` from ${localCollege}.` : body === "all" ? "." : ` from applicants for ${preferredBodies[body]}.`}`;
  const matching = filteredRows.filter((row) => {
    const text = [row.name, applicantDisplayName(row.application), row.position, row.college, row.collegeAbbreviation, row.statusLabel].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  matching.sort(sort === "time" ? newestFirst : alphabetical);
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = matching.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  function setReviewId(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("application", id);
    else url.searchParams.delete("application");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function changeFilter(key: "status" | "body", value: string) {
    const url = new URL(window.location.href);
    if (value === (key === "status" ? "all" : "central")) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    if (url.href === window.location.href) return;
    setPage(0);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <>
      <div className="portal-table-tools portal-registrants-toolbar portal-applicants-toolbar">
        {localCollege === null && <SlidingFilterButtons items={bodyFilters} active={body} label="Filter by where they’d serve" onChange={(value) => changeFilter("body", value)} />}
        <SlidingFilterButtons items={statusFilters} active={status} label="Filter by status" onChange={(value) => changeFilter("status", value)} />
        <div className="portal-applicant-search-tools">
          <label className="portal-search">
            <span className="portal-visually-hidden">Search applicants</span>
            <Search size={15} aria-hidden="true" />
            <input className="portal-input" type="search" value={query} placeholder="Search applicants…" autoComplete="off" spellCheck={false} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
          </label>
          <button
            type="button"
            className="portal-icon-button portal-applicant-sort"
            aria-label={sort === "time" ? "Sorted newest first. Switch to surname A–Z" : "Sorted by surname A–Z. Switch to newest first"}
            aria-pressed={sort === "name"}
            title={sort === "time" ? "Newest first · Switch to surname A–Z" : "Surname A–Z · Switch to newest first"}
            onClick={() => { setSort(sort === "time" ? "name" : "time"); setPage(0); }}
          >
            {sort === "time" ? <Clock size={15} aria-hidden="true" /> : <span className="portal-applicant-sort-letter" aria-hidden="true">A</span>}
          </button>
        </div>
      </div>
      {shown.length === 0 ? <p className="portal-empty" role="status">{filteredRows.length === 0 ? emptyMessage : "No applicants match that search."}</p> : (
        <div className="portal-registrants portal-applicants">
          <div className="portal-registrants-head" aria-hidden="true"><span>Name</span><span>Position</span><span>College / Faculty</span><span>Status</span><span>Date and Time</span><span /></div>
          <ul className="portal-registrants-list" aria-label="Applicants">
            {shown.map((row) => (
              <li className="portal-registrant" key={row.id}>
                <button type="button" className="portal-registrant-toggle" onClick={() => setReviewId(row.id)} aria-haspopup="dialog" aria-label={`Review application for ${applicantDisplayName(row.application)}`}>
                  <span className="portal-registrant-name">{applicantDisplayName(row.application)}</span>
                  <span className="portal-applicant-position">{row.position}</span>
                  <span className="portal-registrant-affiliation" title={row.college}>{row.collegeAbbreviation}</span>
                  <span className="portal-applicant-status"><span className={`portal-tag portal-application-status-tag ${row.statusTone}`}>{row.statusLabel}</span></span>
                  <time className="portal-applicant-submitted" dateTime={row.application.submittedAt}>
                    <span>{submissionDate.format(new Date(row.application.submittedAt))}</span>
                    <span>{submissionTime.format(new Date(row.application.submittedAt))}</span>
                  </time>
                  <span className="portal-list-review" aria-hidden="true"><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {matching.length > 0 && <div className="portal-table-foot">
        <p role="status">Showing {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + shown.length} of {matching.length}{matching.length !== filteredRows.length ? ` (${filteredRows.length} in all)` : ""}</p>
        {pages > 1 && <div className="portal-pager">
          <button type="button" className="portal-button is-small is-ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
          <button type="button" className="portal-button is-small is-ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
        </div>}
      </div>}
      {review && (
        <ApplicationModal onClose={() => setReviewId(null)} titleId={reviewTitleId}>
          <ApplicationDetailsView
            key={review.id}
            application={review.application}
            slotsLeft={slots ? (slots[review.application.preferredBodyId === "local" ? review.application.college : ""]?.[review.application.positionId] ?? 0) : null}
            readOnly={readOnly}
            canOnboard={canOnboard}
            modalTitleId={reviewTitleId}
          />
        </ApplicationModal>
      )}
    </>
  );
}
