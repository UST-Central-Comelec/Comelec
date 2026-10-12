"use client";

import Link from "next/link";
import { useContext, useState } from "react";
import { DirectoryFiltersContext } from "./directory-workspace";
import { Search } from "lucide-react";
import { filterDirectoryDatabase } from "@/lib/portal/directory-database";
import { comelecUnits } from "@/lib/applications/options";
import { accountPositions, chamberRoles, describeAffiliation, type AccountPosition, type ChamberRole } from "@/lib/data/types";
import { formatAccepted, type Declaration } from "@/lib/onboarding/documents";
import { Dropdown } from "./dropdown";
import { MemberAvatar } from "./member-avatar";
import "./directory-database.css";

/** Only the fields the current reader may see are sent from the server. */
export type DirectoryDatabaseRow = {
  id: string;
  name: string;
  unit: string;
  position: AccountPosition;
  role: string;
  college: string;
  program: string;
  yearLevel: string;
  email: string;
  facebookUrl: string;
  photoUrl: string | null;
  studentNumber: string | null;
  contactNumber: string | null;
  chamberRole: ChamberRole | null;
  declarations: Declaration[];
  manageable: boolean;
};

const columns = ["Position", "Name", "Photo", "Unit", "Role", "College or faculty", "Program", "Year level", "UST email", "Facebook", "Student number", "Mobile number", "Chamber role", "E-declarations"];
const unitOptions = [
  { value: "", label: "All units" },
  { value: describeAffiliation("central", null), label: "Central Comelec Unit" },
  ...comelecUnits.map(college => ({ value: describeAffiliation("local", college), label: college })),
];

export function DirectoryDatabase({ people }: { people: DirectoryDatabaseRow[] }) {
  const filters = useContext(DirectoryFiltersContext);
  const [ownUnit, setOwnUnit] = useState("");
  const [ownQuery, setOwnQuery] = useState("");
  const { unit, setUnit, query, setQuery } = filters ?? { unit: ownUnit, setUnit: setOwnUnit, query: ownQuery, setQuery: setOwnQuery };
  const shown = filterDirectoryDatabase(people, unit, query);
  const value = (text: string | null) => text || "—";
  const privateValue = (text: string | null) => text === null ? "Restricted" : value(text);

  return (
    <section className="portal-card is-flush directory-database" aria-label="Directory table view">
      <div className="directory-database-toolbar">
        <label className="portal-search">
          <span className="portal-visually-hidden">Search by name, college, faculty, unit, role or position</span>
          <Search size={15} aria-hidden="true" />
          <input className="portal-input" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, unit, role or position…" autoComplete="off" spellCheck={false} />
        </label>
        <Dropdown label="Filter by unit" value={unit} onChange={setUnit} options={unitOptions} />
      </div>
      <div className="portal-table-wrap directory-database-scroll" tabIndex={0} role="region" aria-label="Directory table, scroll to see all columns">
        <table className="portal-table directory-database-table">
          <caption className="document-editor-label">Commission directory by name, with contact details and onboarding declarations</caption>
          <colgroup>
            <col className="directory-database-position" />
            <col className="directory-database-name" />
            <col className="directory-database-photo" />
            <col span={5} />
            <col className="directory-database-email" />
            <col span={4} />
            <col className="directory-database-agreements" />
          </colgroup>
          <thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>
            {shown.length ? shown.map(person => (
              <tr key={person.id}>
                <td>{accountPositions[person.position]}</td>
                <th scope="row">{person.manageable ? <Link className="portal-row-title" href={`/portal/accounts/${person.id}`}>{person.name}</Link> : person.name}</th>
                <td><MemberAvatar photoUrl={person.photoUrl} /></td>
                <td>{person.unit}</td>
                <td>{value(person.role)}</td>
                <td>{value(person.college)}</td>
                <td>{value(person.program)}</td>
                <td>{value(person.yearLevel)}</td>
                <td><a href={`mailto:${person.email}`}>{person.email}</a></td>
                <td>{person.facebookUrl ? <a href={person.facebookUrl} target="_blank" rel="noreferrer">{person.facebookUrl.replace(/^https?:\/\/(www\.)?/, "")}</a> : "—"}</td>
                <td>{privateValue(person.studentNumber)}</td>
                <td>{person.contactNumber ? <a href={`tel:${person.contactNumber}`}>{person.contactNumber}</a> : privateValue(person.contactNumber)}</td>
                <td>{person.chamberRole ? chamberRoles[person.chamberRole] : "—"}</td>
                <td>{person.declarations.length ? <ul className="directory-database-declarations">{person.declarations.map(item => <li key={item.key}><span>{item.title}</span><small>Accepted {formatAccepted(item.acceptedAt)} · v{item.version}</small></li>)}</ul> : "None on file"}</td>
              </tr>
            )) : <tr><td colSpan={columns.length} className="portal-empty">{query.trim() ? "No people match your search." : "No people in this unit."}</td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="directory-database-footer">
        <span className="portal-muted" aria-live="polite">{shown.length} {shown.length === 1 ? "person" : "people"}</span>
      </footer>
    </section>
  );
}
