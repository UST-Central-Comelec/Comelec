import type { FilingFile } from "@/lib/filing-portal/types";

// A qualified candidate's campaign (supabase/migrations/20261018200000_filing_services_campaign.sql):
// the materials they send for the unit's approval, and their campaign schedule. The rules are the
// Elections Code's (USEC 2011, Article VII). Free of server-only imports: the forms and the server
// check the same rules.

/* Campaign materials */

export type MaterialKind = "tarpaulin" | "poster" | "printed" | "electronic" | "page";
export type MaterialStatus = "submitted" | "approved" | "changes" | "declined";

/** A size limit, long side by short side, in the kind's own unit. */
type Limit = { unit: "m" | "in"; party: [number, number]; independent: [number, number] };

export const materialKinds: Record<MaterialKind, { label: string; hint: string; basis: string; size?: Limit; files: "required" | "optional"; link: "required" | "optional" | "none"; partyWide?: boolean }> = {
  tarpaulin: { label: "Streamer or tarpaulin", hint: "Put up only where the unit designates, one per building for each party or independent candidate.", basis: "Article VII, Section 5.1", size: { unit: "m", party: [3, 1], independent: [1.5, 0.5] }, files: "required", link: "none", partyWide: true },
  poster: { label: "Poster", hint: "Posted only where the unit designates, without glue, paste or any other adhesive.", basis: "Article VII, Section 5.2", size: { unit: "in", party: [17, 11], independent: [11, 8.5] }, files: "required", link: "none", partyWide: true },
  printed: { label: "Sample ballot or handbill", hint: "Printed matter promoting the candidates.", basis: "Article VII, Section 5.3", files: "required", link: "none" },
  electronic: { label: "Electronic campaign material", hint: "A post, graphic, video or message for social media, a website or texts. Attach a copy of it; for a video or audio, a transcript or storyboard.", basis: "Article VII, Section 8", files: "required", link: "optional" },
  page: { label: "Campaign page or profile", hint: "The address of a page where you or your representatives campaign. Every one has to be reported to the unit.", basis: "Article VII, Section 11(b)", files: "optional", link: "required" },
};

export const isMaterialKind = (value: unknown): value is MaterialKind => typeof value === "string" && Object.hasOwn(materialKinds, value);

export type CampaignMaterial = {
  id: string;
  candidacyId: string;
  kind: MaterialKind;
  title: string;
  width: number | null;
  height: number | null;
  placement: string;
  link: string;
  showsParty: boolean;
  files: FilingFile[];
  status: MaterialStatus;
  feedback: string;
  submittedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const materialStatusLabel: Record<MaterialStatus, string> = { submitted: "Waiting for review", approved: "Approved", changes: "Changes asked", declined: "Not approved" };
export const materialStatusTone: Record<MaterialStatus, string> = { submitted: "is-gold", approved: "is-ok", changes: "is-warn", declined: "is-warn" };

/** The size a kind allows a candidate, by whether they run under a party: "3 × 1 m". */
export function sizeLimit(kind: MaterialKind, underParty: boolean) {
  const size = materialKinds[kind].size;
  if (!size) return null;
  const [long, short] = underParty ? size.party : size.independent;
  return { long, short, unit: size.unit, label: `${long} × ${short} ${size.unit === "m" ? "m" : "in"}` };
}

/** What's wrong with a material's size, or null: its long side and short side within the limit, whichever way up. */
export function sizeProblem(kind: MaterialKind, underParty: boolean, width: number | null, height: number | null) {
  const limit = sizeLimit(kind, underParty);
  if (!limit) return null;
  if (!width || !height || width <= 0 || height <= 0) return `Give its width and height in ${limit.unit === "m" ? "metres" : "inches"}.`;
  const [long, short] = width >= height ? [width, height] : [height, width];
  return long > limit.long || short > limit.short ? `${underParty ? "A party’s" : "An independent candidate’s"} ${materialKinds[kind].label.toLowerCase()} can be up to ${limit.label} (${materialKinds[kind].basis}).` : null;
}

export const formatSize = (material: Pick<CampaignMaterial, "kind" | "width" | "height">) => {
  const size = materialKinds[material.kind].size;
  return size && material.width && material.height ? `${material.width} × ${material.height} ${size.unit}` : "";
};

/** The candidate can send a revised version after changes are asked, and take back one not reviewed yet. */
export const canReviseMaterial = (material: Pick<CampaignMaterial, "status">) => material.status === "changes";
export const canWithdrawMaterial = (material: Pick<CampaignMaterial, "status">) => material.status === "submitted";

export const MAX_MATERIAL_FILES = 5;

/* Campaign schedule */

export type ActivityKind = "room-to-room" | "online" | "forum" | "other";
export type ActivityStatus = "submitted" | "approved" | "declined" | "cancelled";

export const activityKinds: Record<ActivityKind, { label: string; hint: string }> = {
  "room-to-room": { label: "Room-to-room campaign", hint: "Up to 15 minutes a room for a party, 3 for an independent candidate; a professor may allow 10 or 2 more (Article VII, Section 2)." },
  online: { label: "Online campaign", hint: "A live session, a stream or a scheduled post. The Code’s campaign rules apply online too (Article VII, Section 8)." },
  forum: { label: "Forum or meeting", hint: "A forum, an assembly or a meeting with students. Parades, motorcades and rallies on campus aren’t allowed (Article VII, Section 6(f))." },
  other: { label: "Other activity", hint: "Anything else you’ll do to campaign." },
};

export const isActivityKind = (value: unknown): value is ActivityKind => typeof value === "string" && Object.hasOwn(activityKinds, value);

export type CampaignActivity = {
  id: string;
  candidacyId: string;
  kind: ActivityKind;
  title: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  details: string;
  status: ActivityStatus;
  feedback: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const activityStatusLabel: Record<ActivityStatus, string> = { submitted: "Waiting for approval", approved: "Approved", declined: "Not approved", cancelled: "Cancelled" };
export const activityStatusTone: Record<ActivityStatus, string> = { submitted: "is-gold", approved: "is-ok", declined: "is-warn", cancelled: "" };

/** The unit hears of a new activity, or a change, five hours ahead at least, not counting midnight to 6 a.m. (Article VII, Section 1.3). */
export const NOTICE_HOURS = 5;
export const MAX_ACTIVITY_HOURS = 12;

const hourMs = 3_600_000;
const manilaShift = 8 * hourMs;
const dayMs = 24 * hourMs;

/** The hours between two instants that count as notice: all of them but those between midnight and 6 a.m. in Manila. */
export function noticeHours(from: number, to: number) {
  if (to <= from) return 0;
  let counted = 0;
  // Walk Manila's days: each counts from 6 a.m. to midnight.
  for (let day = Math.floor((from + manilaShift) / dayMs) * dayMs - manilaShift; day < to; day += dayMs) {
    const start = Math.max(from, day + 6 * hourMs);
    const end = Math.min(to, day + dayMs);
    if (end > start) counted += end - start;
  }
  return counted / hourMs;
}

/** Whether an activity starting at `startsAt` still gives the unit its notice, now. */
export const hasNotice = (startsAt: string | number, now = Date.now()) => noticeHours(now, typeof startsAt === "number" ? startsAt : Date.parse(startsAt)) >= NOTICE_HOURS;

/** The candidate changes or cancels an activity that hasn't started and isn't cancelled. */
export const canChangeActivity = (activity: Pick<CampaignActivity, "status" | "startsAt">, now = Date.now()) => activity.status !== "cancelled" && activity.status !== "declined" && Date.parse(activity.startsAt) > now;

/** Materials and the schedule open once the candidate is on the official list: qualified. */
export const campaignOpen = (candidacy: { status: string }) => candidacy.status === "qualified";
