import type { FilingFile } from "./types";

// The filing portal's Services (supabase/migrations/20261018200000_filing_services_campaign.sql):
// booking a consultation with a Comelec unit, asking for a commissioner at an activity, and filing
// a petition or a case. What each holds, how it's worded, and the rules the forms and the server
// share. Free of server-only imports.

/* Consultations and commissioner requests */

export type RequestKind = "consultation" | "commissioner";
export type RequestStatus = "requested" | "confirmed" | "declined" | "cancelled" | "done";
export type RequestMode = "in-person" | "online";
export type OnBehalf = "self" | "party" | "candidacy";

export type FilingRequest = {
  id: string;
  /** BC-7K3M-9QXA for a consultation, RC-… for a commissioner request. */
  reference: string;
  accountId: string;
  kind: RequestKind;
  /** The unit it's addressed to: "" for the Central Comelec. */
  college: string;
  onBehalf: OnBehalf;
  partyId: string | null;
  partyName: string | null;
  /** A consultation's topic, or what the commissioner is asked to do. */
  topic: string;
  /** A consultation's question in a line, or the activity's name. */
  subject: string;
  details: string;
  mode: RequestMode;
  venue: string;
  /** The time asked for. */
  startsAt: string;
  endsAt: string;
  status: RequestStatus;
  /** What the unit confirmed. */
  confirmedStart: string | null;
  confirmedEnd: string | null;
  location: string;
  assigned: string;
  response: string;
  handledBy: string | null;
  handledAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const requestKinds: Record<RequestKind, { label: string; noun: string; href: string }> = {
  consultation: { label: "Book a consultation", noun: "consultation", href: "/filing/services/consultation" },
  commissioner: { label: "Request a commissioner", noun: "commissioner request", href: "/filing/services/commissioner" },
};

/** What a consultation can be about. */
export const consultationTopics = {
  candidacy: "Filing a candidacy",
  party: "Registering a political party",
  campaign: "The campaign and its rules",
  petition: "A petition or a case",
  other: "Something else",
} as const;

/** What a commissioner can be asked to do at an activity. */
export const commissionerRoles = {
  observe: "Observe the activity",
  speak: "Speak or answer questions",
  officiate: "Witness or administer an oath",
  other: "Something else",
} as const;

export const requestModes: Record<RequestMode, string> = { "in-person": "In person", online: "Online" };
export const onBehalfLabels: Record<OnBehalf, string> = { self: "Myself", party: "My political party", candidacy: "My candidacy" };

export const requestStatusLabel: Record<RequestStatus, string> = { requested: "Waiting for the unit", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled", done: "Done" };
export const requestStatusTone: Record<RequestStatus, string> = { requested: "is-gold", confirmed: "is-ok", declined: "is-warn", cancelled: "", done: "" };

export const topicLabel = (request: Pick<FilingRequest, "kind" | "topic">) =>
  (request.kind === "consultation" ? (consultationTopics as Record<string, string>)[request.topic] : (commissionerRoles as Record<string, string>)[request.topic]) ?? request.topic;

/** A request still to happen: waiting, or confirmed and not over. */
export const isOpenRequest = (request: Pick<FilingRequest, "status" | "endsAt" | "confirmedEnd">, now = Date.now()) =>
  request.status === "requested" || (request.status === "confirmed" && Date.parse(request.confirmedEnd ?? request.endsAt) > now);

/** The filer can cancel one that's waiting, or confirmed and not started. */
export const canCancelRequest = (request: Pick<FilingRequest, "status" | "startsAt" | "confirmedStart">, now = Date.now()) =>
  request.status === "requested" || (request.status === "confirmed" && Date.parse(request.confirmedStart ?? request.startsAt) > now);

/** Booking rules. Consultations are in office hours, Monday to Saturday, a day ahead at least. */
export const CONSULTATION_LEAD_HOURS = 24;
export const CONSULTATION_MINUTES = [30, 60] as const;
export const OFFICE_HOURS = { opens: "08:00", closes: "17:00" } as const;
/** A commissioner is asked for three days ahead at least, for an activity of up to twelve hours. */
export const COMMISSIONER_LEAD_DAYS = 3;
export const MAX_ACTIVITY_HOURS = 12;
/** How many requests an account can have waiting or coming up at once. */
export const MAX_OPEN_REQUESTS = 3;

/** The units an account can turn to, Central ("") first, then each college that has a unit, once. */
export function unitChoicesFor(colleges: ReadonlyArray<string | null | undefined>, known: readonly string[]) {
  const list = [""];
  for (const college of colleges) if (college && known.includes(college) && !list.includes(college)) list.push(college);
  return list;
}

/* Petitions and cases */

export type PetitionType = "qualification" | "nuisance" | "protest" | "offense" | "party" | "other";
export type PetitionStatus = "filed" | "docketed" | "resolved" | "dismissed" | "withdrawn";

export type Petition = {
  id: string;
  /** PC-7K3M-9QXA. */
  reference: string;
  accountId: string;
  college: string;
  type: PetitionType;
  subject: string;
  respondent: string;
  /** YYYY-MM-DD, or "" when it isn't about one day. */
  occurredOn: string;
  statement: string;
  relief: string;
  files: FilingFile[];
  status: PetitionStatus;
  remarks: string;
  docketedBy: string | null;
  docketedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What can be filed, from the Elections Code (USEC 2011). `deadline`: within five school days of what happened (Article XII, Section 4). */
export const petitionTypes: Record<PetitionType, { label: string; hint: string; basis: string; deadline?: boolean; respondent: string }> = {
  qualification: { label: "Qualification contest", hint: "A candidate isn’t eligible for the office they filed for.", basis: "Article VI, Section 8", respondent: "The candidate" },
  nuisance: { label: "Nuisance candidate", hint: "A certificate of candidacy was filed to mock the election, to confuse voters with a similar name, or with no real intention to run.", basis: "Article VI, Section 5", respondent: "The candidate" },
  protest: { label: "Election protest", hint: "About the canvassing of votes, the election returns, or a winner’s election or qualifications.", basis: "Article XII, Section 3", deadline: true, respondent: "The candidate or party, if any" },
  offense: { label: "Election or campaign offense", hint: "Someone broke the Code’s campaign or election rules, such as campaigning outside the campaign period or putting up materials where it isn’t allowed.", basis: "Article VII, Section 6, and Article XII, Section 4", deadline: true, respondent: "Who did it" },
  party: { label: "Complaint against a political party", hint: "Grounds to suspend a party’s registration or cancel it.", basis: "Article V, Sections 7 to 9", respondent: "The party" },
  other: { label: "Other petition", hint: "Such as postponing an election, or declaring a failure of elections.", basis: "Article I, Sections 7 and 8", respondent: "Who it concerns, if anyone" },
};

export const isPetitionType = (value: unknown): value is PetitionType => typeof value === "string" && Object.hasOwn(petitionTypes, value);

export const petitionStatusLabel: Record<PetitionStatus, string> = { filed: "Filed, waiting to be docketed", docketed: "Docketed, being heard", resolved: "Resolved", dismissed: "Dismissed", withdrawn: "Withdrawn" };
export const petitionStatusTone: Record<PetitionStatus, string> = { filed: "is-gold", docketed: "is-gold", resolved: "is-ok", dismissed: "is-warn", withdrawn: "" };

/** The filer can withdraw a petition until it's decided. */
export const canWithdrawPetition = (petition: Pick<Petition, "status">) => petition.status === "filed" || petition.status === "docketed";

export const PETITION_DEADLINE_SCHOOL_DAYS = 5;
export const MAX_PETITION_FILES = 10;

const dayMs = 86_400_000;
const utcDay = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** School days (Monday to Saturday) after `from` up to and including `to`, both YYYY-MM-DD. */
export function schoolDaysBetween(from: string, to: string) {
  let count = 0;
  for (let time = utcDay(from) + dayMs; time <= utcDay(to); time += dayMs) if (new Date(time).getUTCDay() !== 0) count++;
  return count;
}

/** Whether a protest or an offense was filed after its five school days. */
export const isLateFiling = (petition: Pick<Petition, "type" | "occurredOn">, filedOn: string) =>
  Boolean(petitionTypes[petition.type].deadline && petition.occurredOn && schoolDaysBetween(petition.occurredOn, filedOn) > PETITION_DEADLINE_SCHOOL_DAYS);

/* Times, in Manila */

/** "2026-10-20" and "13:30" in Manila as an instant. Manila keeps no daylight saving time. */
export const manilaInstant = (date: string, time: string) => Date.parse(`${date}T${time}:00+08:00`);
/** An instant's Manila date and time: ["2026-10-20", "13:30"]. */
export function manilaParts(iso: string | number): [string, string] {
  const shifted = new Date((typeof iso === "number" ? iso : Date.parse(iso)) + 8 * 3_600_000).toISOString();
  return [shifted.slice(0, 10), shifted.slice(11, 16)];
}

const dateFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

/** "Tue, Oct 20, 2026 · 1:30 – 2:30 PM". */
export function formatSlot(start: string, end: string) {
  const sameDay = manilaParts(start)[0] === manilaParts(end)[0];
  return sameDay ? `${dateFormat.format(new Date(start))} · ${timeFormat.format(new Date(start))} – ${timeFormat.format(new Date(end))}` : `${dateFormat.format(new Date(start))}, ${timeFormat.format(new Date(start))} – ${dateFormat.format(new Date(end))}, ${timeFormat.format(new Date(end))}`;
}
