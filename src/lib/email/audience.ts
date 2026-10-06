// Who an email from the Email Sender goes to. It's a filter over the portal's accounts rather than
// a list of addresses: units, positions and roles, several of each if wanted, and optionally a
// hand-picked set of the people those match. "All commissioners", "every Secretary to the Executive
// and every Chairperson", "the Executive Boards of Science and Pharmacy", "these five people".
// Beside the positions stand the commission's two bodies, En Banc and the Chamber of Chairpersons,
// whose members come from several units: they're picked the same way, as who it's for.
// A scheduled email keeps the filter and is matched against the accounts when it goes out, so it
// reaches whoever holds the position then.
//
// Free of server-only imports: the composer counts recipients with the same code the server sends by.

import { z } from "zod";
import { boardRolesFor, isCentralRepresentative, isLocalChairperson, officeOf } from "@/lib/data/accounts";
import { accountAffiliations, directoryGroups, isCommissionerPosition, type AccountAffiliation, type AccountKind, type AccountPosition } from "@/lib/data/types";

/** The positions that can be picked. None picked means all commissioners: the first three. */
export const audiencePositions = {
  "executive-board": "Executive Board",
  "executive-associate": "Executive Associates",
  deputy: "Deputies",
  adviser: "Advisers",
  admin: "Admins",
} as const satisfies Record<AccountPosition, string>;

/**
 * The commission's bodies, as the Directory has them: En Banc is the Central Executive Board and
 * every college's Central Representative; the Chamber of Chairpersons is every Local Chairperson.
 */
export const audienceBodies = {
  "en-banc": directoryGroups["en-banc"],
  chamber: directoryGroups.chamber,
} as const;

export type AudienceBody = keyof typeof audienceBodies;

/** Everything "Who" can be: the positions, then the bodies. */
export const audienceGroups = { ...audiencePositions, ...audienceBodies } as const;

export type AudienceGroup = keyof typeof audienceGroups;

const isBody = (group: AudienceGroup): group is AudienceBody => Object.hasOwn(audienceBodies, group);

/** "central", "local" (every Local Comelec), "osa", or one Local Comelec as "local:<college>". */
export type AudienceUnit = string;

export type Audience = {
  /** None: every unit. */
  units: AudienceUnit[];
  /** Positions and bodies; someone in any of them matches. None: all commissioners (Executive Board, Executive Associates and Deputies). */
  groups: AudienceGroup[];
  /** Roles exactly as accounts hold them ("Secretary to the Executive", "Office of the Chairperson"). None: any. */
  roles: string[];
  /** Whether the matching units' official accounts get it too. They have no position or role, so only the unit is matched. */
  officials: boolean;
  /** The addresses picked by hand from those the rest matches. None: everyone it matches. */
  only: string[];
};

export const defaultAudience: Audience = { units: [], groups: [], roles: [], officials: false, only: [] };

const audienceShape = z.object({
  units: z.array(z.string().min(1).max(200)).max(60),
  groups: z.array(z.enum(Object.keys(audienceGroups) as [AudienceGroup, ...AudienceGroup[]])).max(Object.keys(audienceGroups).length),
  roles: z.array(z.string().max(120)).max(40),
  officials: z.boolean(),
  only: z.array(z.string().max(254)).max(1000),
});

/**
 * An audience as it was saved or sent, in today's shape. Emails written before several of each
 * could be picked hold one unit, one group and one role.
 */
export const audienceSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || "units" in raw) return raw;
  const old = raw as { unit?: string; group?: string; role?: string; officials?: boolean };
  return {
    units: !old.unit || old.unit === "all" ? [] : [old.unit],
    groups: old.group === "everyone" ? Object.keys(audiencePositions) : !old.group || old.group === "commissioners" ? [] : [old.group],
    roles: old.role ? [old.role] : [],
    officials: Boolean(old.officials),
    only: [],
  };
}, audienceShape);

/** A saved audience, whatever shape it was saved in; the default where it can't be read. */
export function toAudience(raw: unknown): Audience {
  const parsed = audienceSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultAudience;
}

const LOCAL_PREFIX = "local:";

export const localUnit = (college: string): AudienceUnit => `${LOCAL_PREFIX}${college}`;

/** The college of a single Local Comelec's unit, or null for the wider ones. */
export const collegeOf = (unit: AudienceUnit) => (unit.startsWith(LOCAL_PREFIX) ? unit.slice(LOCAL_PREFIX.length) : null);

export const isAudienceUnit = (unit: string) => ["central", "local", "osa"].includes(unit) || Boolean(collegeOf(unit));

/** What matching reads of an account. */
export type Person = { name: string; email: string; kind: AccountKind; affiliation: AccountAffiliation; college: string | null; position: AccountPosition; role: string };

/** Whoever is sending. A Local account reaches only its own college's Local Comelec; anyone else reaches every unit. */
export type Reach = { affiliation: AccountAffiliation; college: string | null };

export const canReach = (sender: Reach, person: Pick<Person, "affiliation" | "college">) => sender.affiliation !== "local" || (person.affiliation === "local" && sender.college !== null && person.college === sender.college);

/** The unit a Local sender is held to, whatever the form says. Null: free to pick. */
export const fixedUnit = (sender: Reach) => (sender.affiliation === "local" && sender.college ? localUnit(sender.college) : null);

function inUnit(unit: AudienceUnit, person: Pick<Person, "affiliation" | "college">) {
  const college = collegeOf(unit);
  if (college !== null) return person.affiliation === "local" && person.college === college;
  return person.affiliation === unit;
}

/** The roles that can be picked for the positions and bodies chosen, in order of rank. None where they have no roles. A body's members are all on an Executive Board. */
export function audienceRoles(groups: readonly AudienceGroup[]): { board: readonly string[]; offices: readonly string[] } {
  // A Local board has every Central role and the Central Representative.
  const board = boardRolesFor("local");
  return { board: !groups.length || groups.some((group) => group === "executive-board" || isBody(group)) ? board : [], offices: !groups.length || groups.includes("executive-associate") ? board.map(officeOf) : [] };
}

/** Whether `person` sits in the body. */
function inBody(body: AudienceBody, person: Person) {
  if (body === "chamber") return isLocalChairperson(person);
  return (person.affiliation === "central" && person.position === "executive-board") || isCentralRepresentative(person);
}

/** Whether the filters match `person`, before any hand-picking. */
export function matchesAudience(audience: Audience, person: Person) {
  if (audience.units.length && !audience.units.some((unit) => inUnit(unit, person))) return false;
  if (person.kind === "official") return audience.officials;
  const inGroup = audience.groups.length ? audience.groups.some((group) => (isBody(group) ? inBody(group, person) : group === person.position)) : isCommissionerPosition(person.position);
  return inGroup && (!audience.roles.length || audience.roles.includes(person.role));
}

/** Everyone the filters match within the sender's reach, one per address, by name: who can be hand-picked. */
export function matchedPeople<T extends Person>(audience: Audience, people: readonly T[], sender: Reach): T[] {
  const seen = new Set<string>();
  return people
    .filter((person) => canReach(sender, person) && matchesAudience(audience, person) && !seen.has(person.email) && seen.add(person.email))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The people an email goes to: those the filters match, or the ones picked by hand among them. */
export function recipientsOf<T extends Person>(audience: Audience, people: readonly T[], sender: Reach): T[] {
  const matched = matchedPeople(audience, people, sender);
  return audience.only.length ? matched.filter((person) => audience.only.includes(person.email)) : matched;
}

/** Inbox delivery keeps every matching membership, including accounts sharing an email address. */
export function inboxRecipientsOf<T extends Person>(audience: Audience, people: readonly T[], sender: Reach): T[] {
  return people.filter((person) => canReach(sender, person) && matchesAudience(audience, person)
    && (!audience.only.length || audience.only.includes(person.email)));
}

export function describeUnit(unit: AudienceUnit) {
  if (unit === "local") return "All Local Comelecs";
  return collegeOf(unit) ?? accountAffiliations[unit as AccountAffiliation] ?? unit;
}

/** "A", "A and B", or "A, B and 2 more". */
const some = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`);

/** "All commissioners · All units", "Secretary to the Executive and Chairperson · College of Science, with official accounts", "3 people picked from …". */
export function describeAudience(audience: Audience) {
  const who = audience.roles.length ? some(audience.roles) : audience.groups.length ? some(audience.groups.map((group) => audienceGroups[group])) : "All commissioners";
  const where = audience.units.length ? some(audience.units.map(describeUnit)) : "All units";
  const filters = `${who} · ${where}${audience.officials ? ", with official accounts" : ""}`;
  return audience.only.length ? `${audience.only.length} picked from ${filters}` : filters;
}

/** A recipient line that does not imply a filtered audience reaches the whole unit. */
export function audienceMention(audience: Audience) {
  if (audience.only.length) return "@Selected recipients";
  if (!audience.units.length && !audience.groups.length && !audience.roles.length) return "@everyone";
  const mentions = audience.units.map(unit => `@${describeUnit(unit)}`);
  if (audience.roles.length) mentions.push(...audience.roles.map(role => `@${role}`));
  else mentions.push(...audience.groups.map(group => `@${audienceGroups[group]}`));
  return mentions.join(" · ");
}
