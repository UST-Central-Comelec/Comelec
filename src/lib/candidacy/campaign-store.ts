import "server-only";

import { toAccount } from "@/lib/filing-portal/accounts";
import type { FilingFile, PublicAccount } from "@/lib/filing-portal/types";
import { createAdminClient } from "@/lib/supabase/server";
import type { ActivityKind, ActivityStatus, CampaignActivity, CampaignMaterial, MaterialKind, MaterialStatus } from "./campaign";
import { toCandidacy } from "./store";
import type { Candidacy } from "./types";

// A candidate's campaign records: public.campaign_materials and public.campaign_activities.
// Callers have checked who's asking first. Every change is filtered on the state it starts from.

type Row = Record<string, unknown>;
const db = () => createAdminClient();
const str = (value: unknown) => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown) => (typeof value === "string" ? value : null);
const numOrNull = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] ?? null : value ?? null);

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Couldn’t ${what}: ${error.message}`);
}

const toFiles = (value: unknown): FilingFile[] => (Array.isArray(value) ? value : []).filter((file): file is FilingFile => Boolean(file) && typeof file === "object" && typeof (file as FilingFile).path === "string");

export const toMaterial = (row: Row): CampaignMaterial => ({
  id: str(row.id), candidacyId: str(row.candidacy_id), kind: str(row.kind) as MaterialKind, title: str(row.title),
  width: numOrNull(row.width), height: numOrNull(row.height), placement: str(row.placement), link: str(row.link), showsParty: row.shows_party === true,
  files: toFiles(row.files), status: str(row.status) as MaterialStatus, feedback: str(row.feedback), submittedAt: str(row.submitted_at),
  reviewedBy: strOrNull(row.reviewed_by), reviewedAt: strOrNull(row.reviewed_at), createdAt: str(row.created_at), updatedAt: str(row.updated_at),
});

export const toActivity = (row: Row): CampaignActivity => ({
  id: str(row.id), candidacyId: str(row.candidacy_id), kind: str(row.kind) as ActivityKind, title: str(row.title), venue: str(row.venue),
  startsAt: str(row.starts_at), endsAt: str(row.ends_at), details: str(row.details), status: str(row.status) as ActivityStatus, feedback: str(row.feedback),
  reviewedBy: strOrNull(row.reviewed_by), reviewedAt: strOrNull(row.reviewed_at), cancelledAt: strOrNull(row.cancelled_at), createdAt: str(row.created_at), updatedAt: str(row.updated_at),
});

/* Materials */

export type MaterialFields = Pick<CampaignMaterial, "kind" | "title" | "width" | "height" | "placement" | "link" | "showsParty">;

const materialColumns = (fields: MaterialFields) => ({ kind: fields.kind, title: fields.title, width: fields.width, height: fields.height, placement: fields.placement, link: fields.link, shows_party: fields.showsParty });

export async function createMaterial(candidacyId: string, fields: MaterialFields, files: FilingFile[]): Promise<CampaignMaterial> {
  const { data, error } = await db().from("campaign_materials").insert({ candidacy_id: candidacyId, ...materialColumns(fields), files }).select("*").single();
  fail("send the material", error);
  return toMaterial(data!);
}

/** A revised version after changes were asked: its details, and its files when new ones came. Null when it moved on. */
export async function reviseMaterial(id: string, candidacyId: string, fields: MaterialFields, files: FilingFile[] | null): Promise<CampaignMaterial | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("campaign_materials").update({ ...materialColumns(fields), ...(files ? { files } : {}), status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", id).eq("candidacy_id", candidacyId).eq("status", "changes").select("*").maybeSingle();
  fail("send the material", error);
  return data ? toMaterial(data) : null;
}

export async function getMaterial(id: string): Promise<CampaignMaterial | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("campaign_materials").select("*").eq("id", id).maybeSingle();
  fail("load the material", error);
  return data ? toMaterial(data) : null;
}

export async function listMaterials(candidacyId: string): Promise<CampaignMaterial[]> {
  const { data, error } = await db().from("campaign_materials").select("*").eq("candidacy_id", candidacyId).order("created_at", { ascending: false });
  fail("load the materials", error);
  return (data ?? []).map(toMaterial);
}

/** The candidate takes back one the unit hasn't reviewed: it's removed. */
export async function withdrawMaterial(id: string, candidacyId: string): Promise<CampaignMaterial | null> {
  const { data, error } = await db().from("campaign_materials").delete().eq("id", id).eq("candidacy_id", candidacyId).eq("status", "submitted").select("*").maybeSingle();
  fail("take the material back", error);
  return data ? toMaterial(data) : null;
}

/** The unit's review: only over the version it opened (`seen`). */
export async function reviewMaterial(id: string, status: Exclude<MaterialStatus, "submitted">, feedback: string, by: string, seen: string): Promise<CampaignMaterial | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("campaign_materials").update({ status, feedback, reviewed_by: by, reviewed_at: now, updated_at: now })
    .eq("id", id).eq("updated_at", seen).select("*").maybeSingle();
  fail("save the review", error);
  return data ? toMaterial(data) : null;
}

/* Activities */

export type ActivityFields = Pick<CampaignActivity, "kind" | "title" | "venue" | "startsAt" | "endsAt" | "details">;

const activityColumns = (fields: ActivityFields) => ({ kind: fields.kind, title: fields.title, venue: fields.venue, starts_at: fields.startsAt, ends_at: fields.endsAt, details: fields.details });

export async function createActivity(candidacyId: string, fields: ActivityFields): Promise<CampaignActivity> {
  const { data, error } = await db().from("campaign_activities").insert({ candidacy_id: candidacyId, ...activityColumns(fields) }).select("*").single();
  fail("add the activity", error);
  return toActivity(data!);
}

/** A change goes back to the unit for approval. Only over the version the candidate opened (`seen`). */
export async function changeActivity(id: string, candidacyId: string, fields: ActivityFields, seen: string): Promise<CampaignActivity | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("campaign_activities").update({ ...activityColumns(fields), status: "submitted", feedback: "", reviewed_by: null, reviewed_at: null, updated_at: now })
    .eq("id", id).eq("candidacy_id", candidacyId).eq("updated_at", seen).in("status", ["submitted", "approved"]).select("*").maybeSingle();
  fail("change the activity", error);
  return data ? toActivity(data) : null;
}

export async function cancelActivity(id: string, candidacyId: string): Promise<CampaignActivity | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("campaign_activities").update({ status: "cancelled", cancelled_at: now, updated_at: now })
    .eq("id", id).eq("candidacy_id", candidacyId).in("status", ["submitted", "approved"]).select("*").maybeSingle();
  fail("cancel the activity", error);
  return data ? toActivity(data) : null;
}

export async function getActivity(id: string): Promise<CampaignActivity | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("campaign_activities").select("*").eq("id", id).maybeSingle();
  fail("load the activity", error);
  return data ? toActivity(data) : null;
}

export async function listActivities(candidacyId: string): Promise<CampaignActivity[]> {
  const { data, error } = await db().from("campaign_activities").select("*").eq("candidacy_id", candidacyId).order("starts_at");
  fail("load the schedule", error);
  return (data ?? []).map(toActivity);
}

export async function reviewActivity(id: string, status: "approved" | "declined", feedback: string, by: string, seen: string): Promise<CampaignActivity | null> {
  const now = new Date().toISOString();
  const { data, error } = await db().from("campaign_activities").update({ status, feedback, reviewed_by: by, reviewed_at: now, updated_at: now })
    .eq("id", id).eq("updated_at", seen).in("status", ["submitted", "approved", "declined"]).select("*").maybeSingle();
  fail("save the review", error);
  return data ? toActivity(data) : null;
}

/* For the unit: every candidate's, with who they are */

export type CampaignOwner = Candidacy & { account: PublicAccount };
const OWNER = "candidacy:candidacies!inner(*, party:parties(name, status, sanction), account:public_accounts(*))";
const toOwner = (row: Row): CampaignOwner => {
  const candidacy = one(row.candidacy as Row | Row[]) as Row;
  return { ...toCandidacy(candidacy), account: toAccount(one(candidacy.account as Row | Row[]) as Row) };
};

export type MaterialRow = CampaignMaterial & { owner: CampaignOwner };
export type ActivityRow = CampaignActivity & { owner: CampaignOwner };

export async function listMaterialsForUnit(college: string | null): Promise<MaterialRow[]> {
  let query = db().from("campaign_materials").select(`*, ${OWNER}`).order("submitted_at", { ascending: false }).limit(2000);
  if (college !== null) query = query.eq("candidacy.college", college);
  const { data, error } = await query;
  fail("load the materials", error);
  return (data ?? []).map((row) => ({ ...toMaterial(row), owner: toOwner(row) }));
}

export async function listActivitiesForUnit(college: string | null): Promise<ActivityRow[]> {
  let query = db().from("campaign_activities").select(`*, ${OWNER}`).order("starts_at").limit(4000);
  if (college !== null) query = query.eq("candidacy.college", college);
  const { data, error } = await query;
  fail("load the schedules", error);
  return (data ?? []).map((row) => ({ ...toActivity(row), owner: toOwner(row) }));
}

/** The moratorium days on the Secretariat calendar that bind a unit's candidates: the Central Comelec's, and the unit's own. */
export async function moratoriumDays(college: string): Promise<Array<{ start: string; end: string; label: string }>> {
  const { data, error } = await db().from("calendar_highlights").select("start_date, end_date, label, college").eq("kind", "moratorium").limit(1000);
  // Before the calendar's migration, there's nothing to keep to.
  if (error) return [];
  return (data ?? []).filter((row) => row.college === null || (college !== "" && row.college === college)).map((row) => ({ start: str(row.start_date), end: str(row.end_date), label: str(row.label) }));
}
