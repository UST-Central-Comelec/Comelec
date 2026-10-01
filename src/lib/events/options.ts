import { affiliations, type Affiliation } from "@/lib/data/types";

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
  /** The day in Manila, as YYYY-MM-DD. */
  eventDate: string;
  /** Manila times, as HH:MM. Ingress is when participants may come in; egress is when they should have left. */
  ingressTime: string | null;
  startsTime: string;
  endsTime: string;
  egressTime: string | null;
  venueMode: VenueMode;
  /** The room and building, or the platform and how to get the link. */
  venueDetails: string;
  openToStudents: boolean;
  openToExternals: boolean;
  openToAdmins: boolean;
  registrationStatus: RegistrationStatus;
  /** The organizing unit: the Central Comelec, or the Local Comelec unit of `college`. */
  organizer: Affiliation;
  college: string | null;
  /** Changes the Central Comelec asked a Local unit to make, until the unit marks them addressed. */
  changeRequest: string | null;
  changeRequestedBy: string | null;
  changeRequestedAt: string | null;
};

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

/** When the activity ends, as a timestamp. Dates and times are Manila's, which keeps no daylight saving time. */
export const endsAt = (event: Pick<CommissionEvent, "eventDate" | "endsTime">) => Date.parse(`${event.eventDate}T${event.endsTime}:00+08:00`);

export const hasEnded = (event: Pick<CommissionEvent, "eventDate" | "endsTime">, now = Date.now()) => now >= endsAt(event);

/** What a visitor can do about an event right now: register, join the waitlist, or neither. */
export type SignUpMode = "register" | "waitlist";

export function signUpMode(event: Pick<CommissionEvent, "registrationStatus" | "eventDate" | "endsTime">, now = Date.now()): SignUpMode | null {
  if (hasEnded(event, now)) return null;
  if (event.registrationStatus === "open") return "register";
  return event.registrationStatus === "waitlist" ? "waitlist" : null;
}

// The registration form ---------------------------------------------------------------------------

export const sexes = {
  male: "Male",
  female: "Female",
  undisclosed: "Prefer not to say",
} as const;

export type Sex = keyof typeof sexes;

/** The interest question's five-point scale, lowest first. The number is what's saved. */
export const interestLevels = [
  { value: 1, label: "Not interested" },
  { value: 2, label: "Slightly interested" },
  { value: 3, label: "Moderately interested" },
  { value: 4, label: "Very interested" },
  { value: 5, label: "Extremely interested" },
] as const;

export type InterestLevel = (typeof interestLevels)[number]["value"];

/** How many organizations one person can list, and how long each name may be. */
export const MAX_ORGANIZATIONS = 8;
export const ORGANIZATION_MAX_LENGTH = 80;

/** Whether someone registered, or joined the waitlist before registration opened. */
export const registrationKinds = {
  registered: "Registered",
  waitlisted: "Waitlist",
} as const;

export type RegistrationKind = keyof typeof registrationKinds;
