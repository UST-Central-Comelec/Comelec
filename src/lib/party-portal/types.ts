import { comelecUnit } from "@/lib/events/options";
import { yearLevels } from "@/lib/applications/options";
import type { FilingDocument } from "@/lib/filing-portal/types";
import { requirements } from "@/lib/polpar/content";

// A political party's registration in the filing portal (supabase/migrations/
// 20261017190000_party_portal.sql), as the pages use it. Free of server-only imports.

export type PartyStatus = "pending" | "accredited" | "declined" | "withdrawn";
/** A label over the status, set by the unit with a reason: lifting it puts the party back where it was. */
export type PartySanction = "suspended" | "blacklisted";
export type MemberStatus = "requested" | "active" | "declined" | "removed";
export type MemberRole = "contact" | "member";

export type Party = {
  id: string;
  /** The party's ID for people: PP-7K3M-9QXA. */
  reference: string;
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
  /** Accredited with documents still outstanding; the remarks say why. */
  decisionOverride: boolean;
  sanction: PartySanction | null;
  sanctionReason: string;
  sanctionedBy: string | null;
  sanctionedAt: string | null;
  /** Set when the registration is withdrawn: by the unit, under PolPaR → Applicants. */
  withdrawnBy: string | null;
  withdrawnAt: string | null;
  withdrawalReason: string;
  createdAt: string;
  updatedAt: string;
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
  /** Set when the unit removes them, or the party's registration is withdrawn. */
  removedBy: string | null;
  removedAt: string | null;
  removalReason: string;
  createdAt: string;
};

export type Submission = FilingDocument & { partyId: string };

export type PartyNotice = { id: string; partyId: string; kind: string; title: string; body: string; href: string | null; actor: string; forContact: boolean; createdAt: string };

/** A party others can join from the registration page: its details, as the form shows them. */
export type JoinableParty = { id: string; name: string; college: string; unit: string; establishedAt: string; headquarters: string; contactName: string };

/** The requirements a party files, each marked whether it's optional: Alumni IDs only apply to a party with active alumni. */
export const partyRequirements = requirements.map((item) => ({ id: item.id as string, label: item.label as string, hint: item.hint as string, template: "template" in item ? item.template : null, optional: item.id === "alumniIds" }));

/** The requirements in the filing portal's subtabs: the POLPAR forms, the members' papers, the party's own. */
export const partyRequirementGroups = [
  { key: "forms", label: "POLPAR forms", hint: "Forms 01 to 06, from the templates.", ids: ["petition", "officers", "members", "alumni", "affiliates", "conforme"] },
  { key: "ids", label: "IDs and registration forms", hint: "Copies for every listed officer, member and active alumni member.", ids: ["registrationForms", "studentIds", "alumniIds"] },
  { key: "charter", label: "Constitution and platform", hint: "The party’s own papers.", ids: ["constitution", "platform", "financial"] },
] as const;
export type PartyRequirementGroup = (typeof partyRequirementGroups)[number]["key"];
export const isPartyRequirementGroup = (value: unknown): value is PartyRequirementGroup => partyRequirementGroups.some((group) => group.key === value);
/** Where a requirement's page is in the filing portal. */
export const partyRequirementHref = (id: string) => `/filing/party/documents/${partyRequirementGroups.find((group) => (group.ids as readonly string[]).includes(id))?.key ?? "forms"}`;

/** "Central Comelec", or "College of Science Comelec Unit". */
export const unitName = (college: string) => (college ? comelecUnit("local", college) : comelecUnit("central", null));

export const yearLevelLabel = (level: string) => (yearLevels as Record<string, string>)[level] ?? level;

export const partyStatusLabel: Record<PartyStatus, string> = { pending: "Pending review", accredited: "Accredited", declined: "Declined", withdrawn: "Withdrawn" };
/** The portal-tag tone for each (portal.css): gold while waiting, green when done, amber when it went the other way. */
export const partyStatusTone: Record<PartyStatus, string> = { pending: "is-gold", accredited: "is-ok", declined: "is-warn", withdrawn: "" };

export const sanctionLabel: Record<PartySanction, string> = { suspended: "Suspended", blacklisted: "Blacklisted" };

/** How a party stands, for a tag: its sanction when it has one, otherwise its status. */
export function partyStanding(party: { status: PartyStatus; sanction: PartySanction | null }) {
  if (party.sanction) return { label: sanctionLabel[party.sanction], tone: party.sanction === "blacklisted" ? "is-danger" : "is-warn" };
  return { label: partyStatusLabel[party.status], tone: partyStatusTone[party.status] };
}

/** Accredited, and not suspended or blacklisted: its members can run under it and its contact person can endorse them. */
export const canFieldCandidates = (party: { status: PartyStatus; sanction: PartySanction | null }) => party.status === "accredited" && party.sanction === null;

/** Still registering, and not suspended or blacklisted: its documents can change and people can ask to join. */
export const isRegistering = (party: { status: PartyStatus; sanction: PartySanction | null }) => party.status === "pending" && party.sanction === null;
