// Who's online, chat and following (src/components/portal/online-*.tsx): what the browser and
// server agree on.

/** How often an open portal tab checks in. */
export const CHECK_IN_MS = 60_000;

/** Seen this recently counts as online: one missed check-in, plus slack for a slow request. */
export const ONLINE_WINDOW_MS = 150_000;

/** How far back the list goes. */
export const RECENT_WINDOW_MS = 24 * 60 * 60_000;

/** Longest chat message. */
export const MESSAGE_MAX = 1000;

export type PresenceUnit = { key: string; name: string };
export function presenceUnit(account: { affiliation: string; college: string | null }): PresenceUnit {
  if (account.affiliation === "local") return { key: `unit:local:${encodeURIComponent(account.college ?? "")}`, name: `Local Comelec · ${account.college ?? "Unassigned"}` };
  return account.affiliation === "osa" ? { key: "unit:osa", name: "Office for Student Affairs" } : { key: "unit:central", name: "Central Comelec" };
}

export type PresenceProfile = {
  name: string;
  avatarUrl: string | null;
  college: string | null;
  position: string;
  role: string;
  unit: string;
  email: string;
};

export type PresencePerson = {
  /** Sign-in address; multiple memberships may share this email. */
  email: string;
  accountId: string;
  /** An opaque id for the person, their key in the live presence channel. */
  id: string;
  name: string;
  /** "Chairperson", or "Chairperson · College of Science" for a Local account. */
  role: string;
  avatarUrl: string | null;
  lastSeenAt: string;
  online: boolean;
  you: boolean;
  unit: PresenceUnit;
  college: string | null;
  collegeAbbreviation?: string;
};

/** Search names, units, faculties/colleges and their abbreviations. */
export function matchesPresenceSearch(person: Pick<PresencePerson, "name" | "college" | "collegeAbbreviation" | "unit">, query: string) {
  const text = `${person.name} ${person.college ?? ""} ${person.collegeAbbreviation ?? ""} ${person.unit.name} ${person.unit.key === "unit:osa" ? "OSA" : ""}`.toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every((word) => text.includes(word));
}

/**
 * Where the browser listens. Both names are derived from the server's secret, and both are private
 * Realtime channels: joining one takes the person's own sign-in token, and the database only lets
 * them into the lobby while they keep checking in, and into no inbox but their own (migration 0077).
 * Everything sent to an inbox comes through the server, which says who sent it.
 */
export type RealtimeInfo = { lobby: string; inbox: string; me: string; email: string; accountId: string; unit: PresenceUnit };

export type RelayKind = "chat" | "unit-chat" | "follow-request" | "follow-accept" | "follow-decline" | "follow-stop" | "path";
export const relayKinds: readonly RelayKind[] = ["chat", "unit-chat", "follow-request", "follow-accept", "follow-decline", "follow-stop", "path"];

/** What arrives in an inbox. `from` is filled in by the server, never the sender. */
export type RelayEvent = {
  kind: RelayKind;
  from: { email: string; accountId: string; id: string; name: string; role: string; avatarUrl: string | null };
  to: string;
  at: string;
  /** chat: the sender's id for the message, so their other tabs don't show it twice. */
  messageId?: string;
  text?: string;
  /** follow-accept and path: the page the followed person is on. */
  path?: string;
};

/** A portal page, as followers are sent to it: no other site, no `..`, nothing odd. */
export function isPortalPath(path: unknown): path is string {
  return typeof path === "string" && path.length <= 500 && /^\/portal(?:[/?]|$)/.test(path) && !/\/\/|\\|\.\.|[\u0000-\u001f\s]/.test(path);
}
