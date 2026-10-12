import { yearLevelsFor } from "@/lib/applications/options";
import { accountPositions, chamberRoles, describeAffiliation, type AccountSummary, type DirectoryEntry } from "@/lib/data/types";
import type { DirectoryDatabaseRow } from "@/components/portal/directory-database";
import { canManageAccount, type Manager } from "./account-scope";

/** Search words may match across name, unit, college and role; the unit dropdown still applies. */
export function filterDirectoryDatabase(people: DirectoryDatabaseRow[], unit: string, query: string): DirectoryDatabaseRow[] {
  const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return people.filter(person => {
    if (unit && person.unit !== unit) return false;
    const text = normalize([person.name, person.unit, person.college, person.role, accountPositions[person.position], person.chamberRole ? chamberRoles[person.chamberRole] : ""].join(" "));
    return terms.every(term => text.includes(term));
  });
}

/** Apply directory visibility and private-field access before sending table rows to the browser. */
export function directoryDatabaseRows(people: DirectoryEntry[], accounts: AccountSummary[], viewer: Manager & { id: string }, manages: boolean): DirectoryDatabaseRow[] {
  const byId = new Map(accounts.map(account => [account.id, account]));
  return people.filter(person => viewer.affiliation !== "local" || (viewer.college !== null && person.affiliation === "local" && person.college === viewer.college))
    .map(person => {
      const account = byId.get(person.id);
      const manageable = manages && (person.id === viewer.id || canManageAccount(viewer, { ...person, kind: "personal" }));
      const reach = manageable || person.id === viewer.id;
      const name = account?.lastName && account.firstName
        ? `${account.lastName}, ${[account.firstName, account.middleName || account.middleInitial].filter(Boolean).join(" ")}`
        : person.name;
      return {
        id: person.id, name, unit: describeAffiliation(person.affiliation, person.college),
        position: person.position, role: person.role, college: person.college ?? "", program: person.program ?? "",
        yearLevel: account?.yearLevel ? (yearLevelsFor(person.college)[account.yearLevel] ?? "") : "",
        email: person.email, facebookUrl: person.facebookUrl ?? "", photoUrl: person.photoUrl,
        studentNumber: reach ? account?.studentNumber ?? "" : null,
        contactNumber: reach ? account?.contactNumber ?? "" : null,
        chamberRole: person.chamberRole, declarations: account?.declarations ?? [], manageable,
      };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
