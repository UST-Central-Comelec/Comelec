// Portal accounts, read and described: the roles a position can hold, how a name is written, and an
// account with the fields older rows lack filled in. Free of server-only imports, so the account
// forms can use it.

import { localRolesByCollege } from "./local-roles";
import { programsByCollege, type College } from "@/lib/applications/options";
import { CENTRAL_REPRESENTATIVE, CHAIRPERSON, DEPUTY, accountKinds, accountPositions, centralRoles, isAccountAffiliation, isAccountPosition, isViewerPosition, localRoles, type AccountAffiliation, type AccountKind, type AccountPosition, type AccountSummary, type Affiliation, type PortalAccount } from "./types";

type Standing = { affiliation: AccountAffiliation; position: AccountPosition; role: string; college?: string | null };

/** The Executive Board's roles in a unit, in order of rank. */
export const boardRolesFor = (affiliation: Affiliation, college?: string | null): readonly string[] => (affiliation === "central" ? centralRoles : college ? (localRolesByCollege[college] ?? localRoles) : [...new Set([...localRoles, ...Object.values(localRolesByCollege).flat()])]);

/** An Executive Associate serves in a board member's office: "Office of the Chairperson". */
export const officeOf = (boardRole: string) => `Office of the ${boardRole}`;

/**
 * The positions an affiliation has. The Office for Student Affairs' people are Admins, and only
 * they are; the commission has its three commissioner positions and its Advisers.
 */
export const positionsFor = (affiliation: AccountAffiliation): readonly AccountPosition[] => (affiliation === "osa" ? ["admin"] : affiliation === "local" ? ["executive-board", "executive-associate", "deputy", "adviser"] : ["executive-board", "executive-associate", "adviser"]);

/** The roles to pick from: the board's own, their offices for associates, and the one role a deputy has. Advisers and Admins have none. */
export function rolesFor(affiliation: AccountAffiliation, position: AccountPosition, college?: string | null): readonly string[] {
  if (affiliation === "osa" || isViewerPosition(position)) return [];
  if (position === "deputy") return [DEPUTY];
  const board = boardRolesFor(affiliation, college);
  return position === "executive-board" ? board : board.map(officeOf);
}

/** Whether `role` fits the position: one from its list, or none where the position has no roles. */
export function isRoleFor(affiliation: AccountAffiliation, position: AccountPosition, role: string, college?: string | null) {
  const roles = rolesFor(affiliation, position, college);
  return roles.length ? roles.includes(role) : role === "";
}

/** Degree programs and SHS strands; EHS and JHS have no program choices. */
export const programsOf = (college: string | null | undefined): readonly string[] => programsByCollege[college as College] ?? [];

/**
 * Which details a personal account has, by position. Commissioners are students, with all of them.
 * Advisers and Admins have no role, program or student ID; an Adviser may have a college (a Local
 * one must: it's their unit), an Admin has none.
 */
export function detailsFor(affiliation: AccountAffiliation, position: AccountPosition) {
  const viewer = isViewerPosition(position);
  return {
    role: rolesFor(affiliation, position).length > 0,
    studentNumber: !viewer,
    program: !viewer,
    college: position === "admin" ? ("none" as const) : position === "adviser" && affiliation !== "local" ? ("optional" as const) : ("required" as const),
  };
}

/** Where a role comes in its unit's order: the board by rank, then their offices in the same order, then deputies. */
export function roleRank(account: Standing) {
  const index = rolesFor(account.affiliation, account.position, account.college).indexOf(account.role);
  return Object.keys(accountPositions).indexOf(account.position) * 100 + (index === -1 ? 99 : index);
}

export const isLocalChairperson = (account: Standing) => account.affiliation === "local" && account.position === "executive-board" && account.role === CHAIRPERSON;

export const isCentralRepresentative = (account: Standing) => account.affiliation === "local" && account.position === "executive-board" && account.role === CENTRAL_REPRESENTATIVE;

/** Names are kept in capitals, as on the application and Request access forms. */
export const upperName = (name: string) => name.trim().replace(/\s+/g, " ").toUpperCase();

/** An official account is named after its unit: "CENTRAL COMELEC", "COLLEGE OF SCIENCE COMELEC". */
export const officialName = (affiliation: AccountAffiliation, college: string | null | undefined) => upperName(affiliation === "local" && college ? `${college} Comelec` : "Central Comelec");

/** "DELA CRUZ" as "Dela Cruz", for the places a name is spoken rather than listed, like a greeting. */
export const properName = (name: string) => name.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());

type NameParts = { lastName: string; firstName: string; middleInitial?: string; middleName?: string };

const middlePart = ({ middleName, middleInitial }: NameParts) => middleName || (middleInitial ? `${middleInitial}.` : "");

/** "JUAN P. DELA CRUZ". */
export const fullName = (parts: NameParts) => [parts.firstName, middlePart(parts), parts.lastName].filter(Boolean).join(" ");

/** "DELA CRUZ, JUAN P.", as lists sort and show it. An account with no name parts (an official one, or an old one) shows its whole name. */
export function listName(account: NameParts & { name: string }) {
  if (!account.lastName) return account.name;
  return `${account.lastName}, ${[account.firstName, middlePart(account)].filter(Boolean).join(" ")}`;
}

/** A Facebook link as it was typed ("facebook.com/juan"), with its scheme, so it can be saved and linked. */
export const facebookHref = (link: string) => (/^https?:\/\//i.test(link) ? link : `https://${link}`);

/** What an account is, in a few words: the role, or the position where there's no role (yet); "Official account" for a unit's own. */
export const describeRole = (account: { kind?: AccountKind; position: AccountPosition; role: string }) => (account.kind === "official" ? accountKinds.official : account.role || accountPositions[account.position]);

// Before supabase/migrations/0021 the role column held one of these, and there was no position.
const legacyPositions: Record<string, AccountPosition> = { executive: "executive-board", commissioner: "executive-associate" };

/** An account as pages read it, with what rows saved before 0017, 0021 and 0022 lack filled in. */
export function toSummary(account: PortalAccount): AccountSummary {
  const { id, name, email, active, createdAt, updatedAt, updatedBy } = account;
  const legacy = legacyPositions[account.role];
  return {
    id,
    name,
    email,
    active,
    createdAt,
    updatedAt,
    updatedBy,
    kind: account.kind === "official" ? "official" : "personal",
    affiliation: isAccountAffiliation(account.affiliation) ? account.affiliation : "central",
    college: account.college ?? null,
    lastName: account.lastName ?? "",
    firstName: account.firstName ?? "",
    middleInitial: account.middleInitial ?? "",
    middleName: account.middleName ?? "",
    yearLevel: account.yearLevel ?? null,
    studentNumber: account.studentNumber ?? null,
    program: account.program ?? null,
    facebookUrl: account.facebookUrl ?? null,
    position: isAccountPosition(account.position) ? account.position : (legacy ?? "executive-associate"),
    role: legacy ? "" : (account.role ?? ""),
    emailVerifiedAt: account.emailVerifiedAt ?? null,
    photoUrl: account.photoUrl ?? null,
    chamberRole: account.chamberRole ?? null,
    builtIn: false,
  };
}

/** Enabled accounts remain pending until their first Google sign-in verifies the email. */
export function accountStatusOf(account: { active: boolean; emailVerifiedAt: string | null }): "pending" | "active" | "revoked" {
  return !account.active ? "revoked" : account.emailVerifiedAt ? "active" : "pending";
}

/** One email may serve in Central and Local, with an independent position in each unit. */
export function sameAccountUnit(a: { affiliation: AccountAffiliation; college: string | null }, b: { affiliation: AccountAffiliation; college: string | null }) {
  return a.affiliation === b.affiliation && (a.affiliation !== "local" || a.college === b.college);
}
