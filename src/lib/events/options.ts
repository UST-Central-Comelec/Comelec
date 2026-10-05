import { affiliations, type Affiliation } from "@/lib/data/types";
import type { PeriodKind } from "@/lib/periods/kinds";

// Events and activities: an event's shape, and the choices on the portal's event form and the
// website's registration form. Free of server-only imports, so client forms can use it. The
// database checks the same keys (supabase/migrations/0019_events.sql); keep them in step.

/** Set by the organizing unit. Only Open and Waitlist let people sign up. */
export const registrationStatuses = {
  closed: "Closed",
  open: "Open",
  waitlist: "Waitlist",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
} as const;

export type RegistrationStatus = keyof typeof registrationStatuses;

/** What each status means for the website, shown beside the choice on the event form. */
export const registrationStatusHints: Record<RegistrationStatus, string> = {
  closed: "Nobody can sign up. The event still shows on the website.",
  open: "Students can register on the website.",
  waitlist: "Registration hasn’t opened yet. Students can join the waitlist instead.",
  cancelled: "The event is called off. It stays listed, marked as cancelled.",
  rescheduled: "The event moved to the date above. Sign-ups are paused until you reopen them.",
};

export const venueModes = {
  onsite: "On-site",
  online: "Online",
  both: "On-site and online",
} as const;

export type VenueMode = keyof typeof venueModes;

/** Who may take part, by the checkboxes on the event form. */
export const audiences = {
  students: "Students",
  externals: "Externals",
  admins: "Admins",
} as const;

export type Audience = keyof typeof audiences;

export type CommissionEvent = {
  id: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  name: string;
  /** The short description shown when the event is opened in the website's list. */
  summary: string;
  /** The event's background, on its own page. Paragraphs are separated by blank lines. */
  background: string;
  /** The day it starts in Manila, as YYYY-MM-DD. */
  eventDate: string;
  /** The day it ends, the same as eventDate for a one-day event. */
  endDate: string;
  /**
   * Manila times, as HH:MM. The activity starts on eventDate at startsTime and ends on endDate at
   * endsTime. Ingress is when participants may come in (on the first day); egress is when they
   * should have left (on the last).
   */
  ingressTime: string | null;
  startsTime: string;
  endsTime: string;
  egressTime: string | null;
  venueMode: VenueMode;
  /** The room and building, the online platform, or both with joining instructions. */
  venueDetails: string;
  openToStudents: boolean;
  openToExternals: boolean;
  openToAdmins: boolean;
  registrationStatus: RegistrationStatus;
  /** Whoever registers as a UST student, faculty or staff verifies their UST Google account first. */
  requireGoogle: boolean;
  /** The organizing unit: the Central Comelec, or the Local Comelec unit of `college`. */
  organizer: Affiliation;
  college: string | null;
  /** Changes the Central Comelec asked a Local unit to make, until the unit marks them addressed. */
  changeRequest: string | null;
  changeRequestedBy: string | null;
  changeRequestedAt: string | null;
};

/**
 * What the event form asks about an event itself: its name, its descriptions, its day and times, its
 * venue and who it's open to. A unit's Recruitment, Political Party Registration and Filing of
 * Candidacy are given the same details under their Settings (src/lib/periods/kinds.ts).
 */
export type EventDetails = Pick<CommissionEvent, "name" | "summary" | "background" | "eventDate" | "endDate" | "ingressTime" | "startsTime" | "endsTime" | "egressTime" | "venueMode" | "venueDetails" | "openToStudents" | "openToExternals" | "openToAdmins">;

/** What a new event form starts with: the given day, an afternoon, on-site, students only. */
export const blankDetails = (date: string): EventDetails => ({ name: "", summary: "", background: "", eventDate: date, endDate: date, ingressTime: null, startsTime: "13:00", endsTime: "15:00", egressTime: null, venueMode: "onsite", venueDetails: "", openToStudents: true, openToExternals: false, openToAdmins: false });

/**
 * What the Events page and the portal's Events tab list: an event, or a unit's Recruitment, Political
 * Party Registration or Filing of Candidacy while it's open, under the event details the unit gave
 * it (`period`). Such a listing leaves the lists again once the unit closes it.
 */
export type Listing = CommissionEvent & { period?: { kind: PeriodKind; /** When it closes by itself, as a timestamp; null with no closing date. */ closesAt: number | null; /** When it opens, while that's still ahead (only the portal lists it then); otherwise null. */ opensAt?: number | null } };

/** Times on the event form are picked in steps of this many minutes. */
export const TIME_STEP_MINUTES = 5;

export const isRegistrationStatus = (value: unknown): value is RegistrationStatus => typeof value === "string" && value in registrationStatuses;

export const isVenueMode = (value: unknown): value is VenueMode => typeof value === "string" && value in venueModes;

/** What event ids look like: the slug made from the event's name when it was added. */
export const isEventId = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);

/** A unit's name: "Central Comelec", or "Faculty of Pharmacy Comelec Unit" for a college's Local Comelec. */
export function comelecUnit(organizer: Affiliation, college: string | null | undefined) {
  if (organizer === "central") return affiliations.central;
  return college ? `${college} Comelec Unit` : affiliations.local;
}

/** Who an event is open to: "Students only", or "Students, externals and admins". */
export function describeAudience(event: Pick<CommissionEvent, "openToStudents" | "openToExternals" | "openToAdmins">) {
  const open = [event.openToStudents && audiences.students, event.openToExternals && audiences.externals, event.openToAdmins && audiences.admins].filter((label): label is (typeof audiences)[Audience] => Boolean(label));
  if (open.length <= 1) return open.length ? `${open[0]} only` : "To be announced";
  const lower = open.map((label, index) => (index === 0 ? label : label.toLowerCase()));
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

/** A Manila date and time as a timestamp. Manila keeps no daylight saving time. */
export const manilaMoment = (date: string, time: string) => Date.parse(`${date}T${time}:00+08:00`);

/** When the activity ends, on its last day, as a timestamp. */
export const endsAt = (event: Pick<CommissionEvent, "endDate" | "endsTime">) => manilaMoment(event.endDate, event.endsTime);

export const hasEnded = (event: Pick<CommissionEvent, "endDate" | "endsTime">, now = Date.now()) => now >= endsAt(event);

/** Whether a listing is over. A unit's period is only listed while it's open, so it never is, whatever its date. */
export const isOver = (listing: Pick<Listing, "endDate" | "endsTime" | "period">, now = Date.now()) => !listing.period && hasEnded(listing, now);

/** What a visitor can do about an event right now: register, join the waitlist, or neither. */
export type SignUpMode = "register" | "waitlist";

export function signUpMode(event: Pick<CommissionEvent, "registrationStatus" | "endDate" | "endsTime">, now = Date.now()): SignUpMode | null {
  if (hasEnded(event, now)) return null;
  if (event.registrationStatus === "open") return "register";
  return event.registrationStatus === "waitlist" ? "waitlist" : null;
}

// The registration form ---------------------------------------------------------------------------
// Five steps: consent; personal information; university affiliation; organization; logistics. The
// rules are in ./schema.ts, shared by the form and the server.

/** How a registrant's sex reads in the portal. "Prefer not to say" is only on registrations made before it was taken off the form. */
export const sexes = {
  male: "Male",
  female: "Female",
  undisclosed: "Prefer not to say",
} as const;

export type Sex = keyof typeof sexes;

/** What the registration form offers. */
export const sexChoices = { male: sexes.male, female: sexes.female } as const;

export type SexChoice = keyof typeof sexChoices;

/** How someone is affiliated with the University, and so which details they give and whether they verify. */
export const affiliationChoices = {
  "ust-student": "Yes, I am a UST Student",
  "ust-staff": "Yes, I am a UST Faculty/Staff Member",
  "other-institution": "No, I am affiliated with another institution",
  independent: "No, I am an Independent Participant",
} as const;

export type AffiliationChoice = keyof typeof affiliationChoices;

/** The same, as a short label for the portal. */
export const affiliationLabels: Record<AffiliationChoice, string> = {
  "ust-student": "UST student",
  "ust-staff": "UST faculty or staff",
  "other-institution": "Another institution",
  independent: "Independent participant",
};

export const isUstAffiliation = (value: unknown) => value === "ust-student" || value === "ust-staff";

/** Every registration form offers all four affiliations, whoever the event lists under Participants. */
export const allowedAffiliations = (): AffiliationChoice[] => Object.keys(affiliationChoices) as AffiliationChoice[];

export const attendingChoices = {
  representative: "Official Organization Representative",
  independent: "Independent Participant",
} as const;

export type AttendingChoice = keyof typeof attendingChoices;

/** What can be asked for under Logistics, each answered by the organizing unit. */
export const requestKinds = {
  parking: { label: "I would like to request for a car parking reservation", short: "Car parking" },
  accessibility: { label: "I would like to request for accessibility assistance", short: "Accessibility assistance" },
  navigation: { label: "I would like to request for navigation assistance upon arrival", short: "Navigation assistance" },
  dietary: { label: "I have dietary restrictions", short: "Dietary restrictions" },
  certificate: { label: "I would like to request a Certificate of Participation", short: "Certificate of Participation" },
  excuseLetter: { label: "I would like to request an Excuse Letter", short: "Excuse letter" },
} as const;

export type RequestKind = keyof typeof requestKinds;

export const requestStatuses = { pending: "Pending", approved: "Approved", unavailable: "Not available", revoked: "Revoked" } as const;

export type RequestStatus = keyof typeof requestStatuses;

/** Withdrawing an approval remains a revocation after saving and reloading. */
export function requestDecisionStatus(current: RequestStatus, approved: boolean): RequestStatus {
  return approved ? "approved" : current === "approved" || current === "revoked" ? "revoked" : "unavailable";
}

/** One request and the unit's answer. Parking and dietary carry what the registrant wrote. */
export type RequestEntry = { status: RequestStatus; plate?: string; model?: string; color?: string; arrival?: string; allergens?: string };

export type Requests = Partial<Record<RequestKind, RequestEntry>>;

/** What saving a registrant's Logistics answers came to (src/lib/portal/event-actions.ts), for the line under the Save button. */
export type DecisionsResult = { error?: string; saved?: number; email?: "sent" | "failed" | "off"; to?: string };

export const isRequestKind = (value: unknown): value is RequestKind => typeof value === "string" && Object.hasOwn(requestKinds, value);

/** Whether someone registered, or joined the waitlist before registration opened. */
export const registrationKinds = {
  registered: "Registered",
  waitlisted: "Waitlist",
} as const;

export type RegistrationKind = keyof typeof registrationKinds;
