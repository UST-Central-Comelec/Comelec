// Which unit of the commission something concerns, and so who in the commission hears about it.
//
// Every form asks whether the matter is the Central Comelec's or a Local Comelec's, and which
// college's if Local. That answer is the concern, and it decides two things for the emails the
// site sends by itself:
//   • who is told: a Central matter goes to the Central Comelec's official account and its
//     Executive Board, and to nobody Local; a Local matter goes to that college's official account
//     and its Executive Board, and to nobody else, the Central Comelec included;
//   • how it reads: every email leaves from the Central Comelec's mailbox, the only one connected,
//     so one about a Local unit says it came through the Central Comelec's COMET rather than
//     speaking as that unit.
//
// Free of server-only imports: the list of automatic emails in the portal names the same recipients.

import { roleRank } from "@/lib/data/accounts";
import type { AccountSummary } from "@/lib/data/types";
import { comelecUnit } from "@/lib/events/options";

export type Concern = { unit: "central" } | { unit: "local"; college: string };

export const CENTRAL: Concern = { unit: "central" };

/** The concern of something filed under an affiliation and a college: Local only when it names the college. */
export const concernOf = (affiliation: string | null | undefined, college: string | null | undefined): Concern => (affiliation === "local" && college ? { unit: "local", college } : CENTRAL);

export const isLocalConcern = (concern: Concern): concern is Extract<Concern, { unit: "local" }> => concern.unit === "local";

/** "Central Comelec", or "College of Science Comelec Unit". */
export const unitOf = (concern: Concern) => comelecUnit(concern.unit, isLocalConcern(concern) ? concern.college : null);

/** The site, as an email about a Local unit names what it came through. */
export const COMET = "Central Comelec COMET";

/** "Application received" for the Central Comelec; "Application received through the Central Comelec COMET" for a Local unit. */
export const through = (what: string, concern: Concern) => (isLocalConcern(concern) ? `${what} through the ${COMET}` : what);

/** An email's topic line: the topic alone for the Central Comelec, with the unit after it for a Local one. */
export const topicFor = (topic: string, concern: Concern) => (isLocalConcern(concern) ? `${topic} · ${unitOf(concern)}` : topic);

/**
 * Why an email about a Local unit comes from the Central Comelec, for its foot. Null for a Central
 * matter, where there's nothing to explain. `holds` is what the unit has: "your application",
 * "this petition".
 */
export const relayNote = (concern: Concern, holds: string) =>
  isLocalConcern(concern) ? `This email comes from the UST Central Comelec’s mailbox because COMET, its website, serves every unit of the commission. ${holds[0].toUpperCase()}${holds.slice(1)} is with the ${unitOf(concern)}.` : null;

export type Recipient = { name: string; email: string };

type Listed = Pick<AccountSummary, "name" | "email" | "active" | "kind" | "affiliation" | "college" | "position" | "role">;

const inUnit = (concern: Concern, account: Pick<Listed, "affiliation" | "college">) => (isLocalConcern(concern) ? account.affiliation === "local" && account.college === concern.college : account.affiliation === "central");

/**
 * Who in the commission is told about `concern`: the unit's official account, then its Executive
 * Board in order of rank. Only active accounts, and only that unit's.
 */
export function unitRecipients(concern: Concern, accounts: readonly Listed[]): Recipient[] {
  const seen = new Set<string>();
  return accounts
    .filter((account) => account.active && inUnit(concern, account) && (account.kind === "official" || account.position === "executive-board"))
    .sort((a, b) => Number(b.kind === "official") - Number(a.kind === "official") || roleRank(a) - roleRank(b) || a.name.localeCompare(b.name))
    .filter((account) => !seen.has(account.email) && seen.add(account.email))
    .map(({ name, email }) => ({ name, email }));
}

/** Who that is, in words: "the Central Comelec’s official account and Executive Board". */
export const describeRecipients = (concern: Concern) => `the ${unitOf(concern)}’s official account and Executive Board`;
