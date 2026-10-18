"use client";

import { Fragment, useId, useRef, useState } from "react";
import { SearchIcon, ViewIcon } from "@/components/action-icons";
import { RequestForm, RequestList, type BehalfOption, type UnitOption } from "@/components/filing-portal/services";
import { Dropdown } from "@/components/portal/dropdown";
import { SlidingFilterButtons } from "@/components/portal/sliding-filters";
import { formatSlot, requestModes, requestStatusLabel, requestStatusTone, topicLabel, type FilingRequest, type RequestKind } from "@/lib/filing-portal/services";
import { scrollToElement } from "@/lib/scroll";
import "./request-workspace.css";

type Props = {
  kind: RequestKind;
  units: UnitOption[];
  behalf: BehalfOption[];
  requests: FilingRequest[];
  cancellable: string[];
  unitNames: Record<string, string>;
  empty: string;
};

/** Keep the setter mounted so checking a record doesn't discard an unfinished appointment. */
export function RequestWorkspace({ kind, units, behalf, ...records }: Props) {
  const [view, setView] = useState<"setter" | "records">("setter");
  const container = useRef<HTMLDivElement>(null);
  return (
    <div ref={container} className="pp-request-workspace">
      <SlidingFilterButtons
        label="Appointment views"
        active={view}
        items={[{ key: "setter", label: "Appointment setter" }, { key: "records", label: "Records" }]}
        onChange={(next) => {
          setView(next);
          if (container.current) scrollToElement(container.current, { smooth: true });
        }}
      />
      <section hidden={view !== "setter"} aria-label="Appointment setter">
        <RequestForm kind={kind} units={units} behalf={behalf} />
      </section>
      <section hidden={view !== "records"} aria-label="Appointment records">
        <RequestRecords {...records} />
      </section>
    </div>
  );
}

function RequestRecords({ requests, cancellable, unitNames, empty }: Pick<Props, "requests" | "cancellable" | "unitNames" | "empty">) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [opened, setOpened] = useState<string | null>(null);
  const search = query.trim().toLocaleLowerCase();
  const matching = requests.filter((request) => (!status || request.status === status) &&
    [request.reference, request.subject, topicLabel(request), unitNames[request.college] ?? request.college, request.partyName, requestStatusLabel[request.status]]
      .some((value) => value?.toLocaleLowerCase().includes(search)));

  return (
    <div className="portal-card is-flush">
      <div className="portal-table-tools pp-request-tools">
        <div className="pp-request-status">
          <Dropdown value={status} onChange={setStatus} label="Filter by status" options={[{ value: "", label: "All statuses" }, ...Object.entries(requestStatusLabel).map(([value, label]) => ({ value, label }))]} />
        </div>
        <label className="portal-search">
          <SearchIcon size={16} aria-hidden="true" />
          <input type="search" className="portal-input" aria-label="Search appointment records" placeholder="Search reference, subject or unit…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <div className="portal-table-wrap" role="region" aria-label="Appointment records table" tabIndex={0}>
        <table className="portal-table pp-request-table">
          <thead><tr><th scope="col">Reference</th><th scope="col">Subject</th><th scope="col">Appointment</th><th scope="col">Status</th><th scope="col" aria-label="Details" /></tr></thead>
          <tbody>
            {matching.map((request) => {
              const expanded = opened === request.id;
              const confirmed = request.status === "confirmed" || (request.status === "done" && request.confirmedStart);
              return (
                <Fragment key={request.id}>
                  <tr>
                    <td className="is-nowrap">{request.reference}</td>
                    <td><strong>{request.subject}</strong><small>{unitNames[request.college] ?? request.college} · {topicLabel(request)}</small></td>
                    <td>{formatSlot(confirmed ? request.confirmedStart ?? request.startsAt : request.startsAt, confirmed ? request.confirmedEnd ?? request.endsAt : request.endsAt)}<small>{confirmed ? "Confirmed" : "Requested"} · {requestModes[request.mode]}</small></td>
                    <td><span className={`portal-tag ${requestStatusTone[request.status]}`}>{requestStatusLabel[request.status]}</span></td>
                    <td className="portal-row-actions"><button type="button" className="portal-icon-button" aria-label={`View appointment ${request.reference}`} aria-expanded={expanded} aria-controls={`${id}-${request.id}`} onClick={() => setOpened(expanded ? null : request.id)}><ViewIcon size={16} aria-hidden="true" /></button></td>
                  </tr>
                  <tr hidden={!expanded} className="pp-request-detail-row"><td colSpan={5} id={`${id}-${request.id}`}>
                    {expanded && <RequestList requests={[request]} cancellable={cancellable} unitNames={unitNames} empty={empty} />}
                  </td></tr>
                </Fragment>
              );
            })}
            {!matching.length && <tr><td colSpan={5}><p className="portal-empty" role="status">{requests.length ? "No appointments match your search or status." : empty}</p></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="portal-table-foot"><p role="status">{matching.length} of {requests.length} appointment{requests.length === 1 ? "" : "s"}</p></div>
    </div>
  );
}
