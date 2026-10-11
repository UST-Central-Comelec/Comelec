import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { workingDocumentKind, type Letter, type LetterValues, type WorkingDocument } from "./options";
import { normalizeDestinationOffice } from "./offices";
import { controlNumber, numberMode, type SecretariatSettings, type TrackerKind } from "./settings";

export const lettersUnavailable = "Couldn’t load or save tracker records. Apply the Secretariat migrations through supabase/migrations/0068_secretariat_settings.sql, then reload.";
export type { TrackerKind };
const tableName = (kind: TrackerKind) => kind === "minutes" ? "secretariat_minutes" : "secretariat_letters";

type Row = { id: string; control_number: string; control_format: string | null; title: string; label: Letter["label"]; type: Letter["type"]; status: Letter["status"]; destination_office: string; working_document: string; working_documents: WorkingDocument[]; remarks: string; notify_status_updates: boolean; remark_presets: Letter["remarkPresets"]; college: string | null; prepared_by: string; created_by: string; created_at: string; updated_at: string };
const fields = "id,control_number,control_format,title,label,type,status,destination_office,working_document,working_documents,remarks,notify_status_updates,remark_presets,college,prepared_by,created_by,created_at,updated_at";
const fromRow = (row: Row): Letter => {
  const legacyType = workingDocumentKind(row.working_document);
  return { id: row.id, controlNumber: row.control_number, controlFormat: row.control_format ?? null, title: row.title, label: row.label ?? null, type: row.type, status: row.status, destinationOffice: normalizeDestinationOffice(row.destination_office), remarks: row.remarks ?? "", notifyStatusUpdates: row.notify_status_updates ?? false, remarkPresets: row.remark_presets ?? [], workingDocuments: row.working_documents?.length ? row.working_documents : legacyType ? [{ type: legacyType, url: row.working_document }] : [], college: row.college, preparedBy: row.prepared_by, preparedByEmail: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at };
};

/** A preview only: the insert trigger assigns the final number when the record is saved. */
export async function previewControlNumber(format: string): Promise<string> {
  if (!isSupabaseConfigured()) return controlNumber(format, 1);
  const { data, error } = await createAdminClient().rpc("preview_secretariat_control_number", { p_format: format });
  if (error || typeof data !== "string") throw new Error("Couldn’t load the next control number. Apply supabase/migrations/0068_secretariat_settings.sql, then reload.");
  return data;
}

export async function listLetters(scope: { local: boolean; college: string | null }, kind: TrackerKind = "letters"): Promise<Letter[]> {
  if (!isSupabaseConfigured() || (scope.local && !scope.college)) return [];
  const letters: Letter[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = createAdminClient().from(tableName(kind)).select(fields).order("control_sequence", { ascending: false }).order("id").range(offset, offset + 999);
    if (scope.local) query = query.eq("college", scope.college!);
    const { data, error } = await query;
    if (error) throw new Error(lettersUnavailable);
    letters.push(...(data as Row[]).map(fromRow));
    if (data.length < 1000) return letters;
  }
}

type Numbered = { type: string; control_format: string | null; control_number: string };

/**
 * The numbering columns to write, or none to keep the record's number. A record keeps its number
 * while its type stays the same, even after that type's format changes in Settings. Automatic
 * numbers are assigned by the database trigger from `control_format`, so a type change to another
 * automatic format takes the next number of that format.
 */
function numbering(values: LetterValues, settings: SecretariatSettings, kind: TrackerKind, existing: Numbered | null) {
  const tracker = settings[kind];
  const type = tracker.types.find(item => item.name === values.type)!;
  const mode = numberMode(tracker, type);
  if (mode === "manual") return existing?.control_number === values.controlNumber ? {} : { control_format: null, control_number: values.controlNumber };
  if (existing?.type === values.type) return {};
  if (mode === "auto") return existing?.control_format === type.format ? {} : { control_format: type.format };
  return !existing?.control_format && existing?.control_number === type.format ? {} : { control_format: null, control_number: type.format };
}

/** Scope is supplied only by the authenticated server action, never by form fields. */
export async function writeLetter(id: string | null, values: LetterValues, actor: { email: string; name: string; local: boolean; college: string | null }, settings: SecretariatSettings, kind: TrackerKind = "letters"): Promise<Letter> {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured before records can be saved.");
  if (actor.local && !actor.college) throw new Error("Your account needs a college to manage records.");
  const data = { title: values.title, label: values.label, type: values.type, status: values.status, destination_office: values.destinationOffice, working_document: values.workingDocuments[0]?.url ?? "", working_documents: values.workingDocuments, remarks: values.remarks, notify_status_updates: values.notifyStatusUpdates, remark_presets: values.remarkPresets, updated_at: new Date().toISOString(), updated_by: actor.email };
  const table = () => createAdminClient().from(tableName(kind));
  let existing: Numbered | null = null;
  if (id) {
    let lookup = table().select("type,control_format,control_number").eq("id", id);
    if (actor.local) lookup = lookup.eq("college", actor.college!);
    const { data: found, error } = await lookup.maybeSingle();
    if (error) throw new Error(lettersUnavailable);
    if (!found) throw new Error("This record is unavailable or you don’t have access to it.");
    existing = found as Numbered;
  }
  const number = numbering(values, settings, kind, existing);
  let query = id ? table().update({ ...data, ...number }).eq("id", id) : table().insert({ ...data, ...number, college: actor.local ? actor.college : null, created_by: actor.email, prepared_by: actor.name || actor.email });
  if (id && actor.local) query = query.eq("college", actor.college!);
  const { data: row, error } = await query.select(fields).maybeSingle();
  if (error) throw new Error(lettersUnavailable);
  if (!row) throw new Error("This record is unavailable or you don’t have access to it.");
  return fromRow(row as Row);
}

/** Only the authenticated server action supplies the caller's unit scope. */
export async function removeLetter(id: string, scope: { local: boolean; college: string | null }, kind: TrackerKind = "letters"): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured before records can be deleted.");
  if (scope.local && !scope.college) throw new Error("Your account needs a college to manage records.");
  let query = createAdminClient().from(tableName(kind)).delete().eq("id", id);
  if (scope.local) query = query.eq("college", scope.college!);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error("Couldn’t delete this record. Try again.");
  if (!data) throw new Error("This record is unavailable or you don’t have access to it.");
}

/** Label-only edits never overwrite the letter's other fields or change its status. */
export async function writeLetterLabel(id: string, label: Letter["label"], actor: { email: string; local: boolean; college: string | null }, kind: TrackerKind = "letters"): Promise<Letter> {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured before labels can be saved.");
  if (actor.local && !actor.college) throw new Error("Your account needs a college to manage records.");
  let query = createAdminClient().from(tableName(kind)).update({ label, updated_at: new Date().toISOString(), updated_by: actor.email }).eq("id", id);
  if (actor.local) query = query.eq("college", actor.college!);
  const { data, error } = await query.select(fields).maybeSingle();
  if (error) throw new Error(lettersUnavailable);
  if (!data) throw new Error("This record is unavailable or you don’t have access to it.");
  return fromRow(data as Row);
}
