import { comelecUnit } from "@/lib/events/options";
import { yearLevels } from "@/lib/applications/options";
import type { FilingDocument } from "@/lib/filing-portal/types";

// A political party's registration in the filing portal (supabase/migrations/
// 20261017190000_party_portal.sql), as the pages use it. Free of server-only imports.

export type PartyStatus = "pending" | "accredited" | "declined" | "withdrawn";
export type MemberStatus = "requested" | "active" | "declined" | "removed";
export type MemberRole = "contact" | "member";

export type Party = {
  id: string;
  name: string;
  /** The unit it registers with: "" for the Central Comelec, else the college of a Local unit. */
  college: string;
  establishedAt: string;
  headquarters: string;
  contactMemberId: string | null;
  status: PartyStatus;
  decisionRemarks: string;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

/** A filing portal account's membership in a party, with its profile as it was when they joined. */
export type PartyMember = {
  id: string;
  partyId: string;
  accountId: string | null;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  studentNumber: string;
  mobileNumber: string;
  facebookUrl: string;
  college: string;
  program: string;
  yearLevel: string;
  role: MemberRole;
  status: MemberStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type Submission = FilingDocument & { partyId: string };

export type PartyNotice = { id: string; partyId: string; kind: string; title: string; body: string; href: string | null; actor: string; forContact: boolean; createdAt: string };

/** A party others can join from the registration page: its details, as the form shows them. */
export type JoinableParty = { id: string; name: string; college: string; unit: string; establishedAt: string; headquarters: string; contactName: string };

/** "Central Comelec", or "College of Science Comelec Unit". */
export const unitName = (college: string) => (college ? comelecUnit("local", college) : comelecUnit("central", null));

export const yearLevelLabel = (level: string) => (yearLevels as Record<string, string>)[level] ?? level;

export const partyStatusLabel: Record<PartyStatus, string> = { pending: "Pending review", accredited: "Accredited", declined: "Declined", withdrawn: "Withdrawn" };
/** The portal-tag tone for each (portal.css): gold while waiting, green when done, amber when it went the other way. */
export const partyStatusTone: Record<PartyStatus, string> = { pending: "is-gold", accredited: "is-ok", declined: "is-warn", withdrawn: "" };
