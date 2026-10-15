import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { workingDocumentKind, type EventPaperContext, type Letter, type LetterValues, type WorkingDocument } from "./options";
import { normalizeDestinationOffice } from "./offices";
import { controlNumber, numberMode, type SecretariatSettings, type TrackerKind } from "./settings";

export const lettersUnavailable = "Couldn’t load or save tracker records. Apply the Secretariat migrations through supabase/migrations/0068_secretariat_settings.sql and the event_documentations and event_control_numbers migrations, then reload.";
export type { TrackerKind };
export type LetterScope = { local: boolean; college: string | null; eventId?: string };
const tableName = (kind: TrackerKind) => kind === "minutes" ? "secretariat_minutes" : "secretariat_letters";

type Row = { id: string; control_number: string; control_format: string | null; title: string; label: Letter["label"]; type: Letter["type"]; status: Letter["status"]; destination_office: string; working_document: string; working_documents: WorkingDocument[]; remarks: string; notify_status_updates: boolean; remark_presets: Letter["remarkPresets"]; college: string | null; prepared_by: string; created_by: string; created_at: string; updated_at: string };
const fields = "id,control_number,control_format,title,label,type,status,destination_office,working_document,working_documents,remarks,notify_status_updates,remark_presets,college,prepared_by,created_by,created_at,updated_at";
const fromRow = (row: Row): Letter => {
  const legacyType = workingDocumentKind(row.working_document);
  return { id: row.id, controlNumber: row.control_number, controlFormat: row.control_format ?? null, title: row.title, label: row.label ?? null, type: row.type, status: row.status, destinationOffice: normalizeDestinationOffice(row.destination_office), remarks: row.remarks ?? "", notifyStatusUpdates: row.notify_status_updates ?? false, remarkPresets: row.remark_presets ?? [], workingDocuments: row.working_documents?.length ? row.working_documents : legacyType ? [{ type: legacyType, url: row.working_document }] : [], college: row.college, preparedBy: row.prepared_by, preparedByEmail: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at };
};

/** Someone else saved the record after it was opened, so nothing was saved: theirs, and who saved it. */
export class RecordConflict extends Error {
  constructor(readonly letter: Letter, readonly by: string) {
    super("This record was saved by someone else while you were editing.");
  }
}

/** A preview only: the insert trigger assigns the final number when the record is saved. */
export async function previewControlNumber(format: string): Promise<string> {
  if (!isSupabaseConfigured()) return controlNumber(format, 1);
  const { data, error } = await createAdminClient().rpc("preview_secretariat_control_number", { p_format: format });
  if (error || typeof data !== "string") throw new Error("Couldn’t load the next control number. Apply supabase/migrations/0068_secretariat_settings.sql, then reload.");
  return data;
}

/** The database previews the same per-event counter and fixed-form suffix used at save time. */
export async function previewEventDocumentControlNumber(eventId: string, type: string): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured before event documents can be numbered.");
  const { data, error } = await createAdminClient().rpc("preview_event_document_control_number", { p_event_id: eventId, p_type: type });
  if (error || typeof data !== "string") throw new Error("Couldn’t load the document number. Apply the event_control_numbers migration, then reload.");
  return data;
}

export async function listLetters(scope: LetterScope, kind: TrackerKind = "letters"): Promise<Letter[]> {
  if (!isSupabaseConfigured() || (scope.local && !scope.college)) return [];
  const letters: Letter[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = createAdminClient().from(tableName(kind)).select(fields).order("control_sequence", { ascending: false }).order("id").range(offset, offset + 999);
    if (kind === "letters") query = scope.eventId ? query.eq("event_id", scope.eventId) : query.is("event_id", null);
    if (scope.local) query = query.eq("college", scope.college!);
    const { data, error } = await query;
    if (error) throw new Error(lettersUnavailable);
    letters.push(...(data as Row[]).map(fromRow));
    if (data.length < 1000) return letters;
  }
}

/** All event documentation in the caller’s unit scope, excluding general letters. */
export async function listEventPapers(scope: Pick<LetterScope, "local" | "college">): Promise<Letter[]> {
  if (!isSupabaseConfigured() || (scope.local && !scope.college)) return [];
  const papers: Letter[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = createAdminClient().from("secretariat_letters")
      .select(`${fields},event:events!inner(id,name,organizer,college,controlNumber:control_number)`)
      .order("control_sequence", { ascending: false }).order("id").range(offset, offset + 999);
    if (scope.local) query = query.eq("event.organizer", "local").eq("event.college", scope.college!);
    const { data, error } = await query;
    if (error) throw new Error(lettersUnavailable);
    const rows = data as unknown as Array<Row & { event: EventPaperContext }>;
    papers.push(...rows.map(row => ({ ...fromRow(row), event: row.event })));
    if (rows.length < 1000) return papers;
  }
}

type Numbered = { type: string; control_format: string | null; control_number: string; updated_at?: string };

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

/**
 * Scope is supplied only by the authenticated server action, never by form fields. `expected` is
 * when the record the editor opened was last saved: it's saved only over that, and otherwise
 * throws `RecordConflict` with the record as it is now.
 */
export async function writeLetter(id: string | null, values: LetterValues, actor: LetterScope & { email: string; name: string }, settings: SecretariatSettings, kind: TrackerKind = "letters", expected: string | null = null): Promise<Letter> {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured before records can be saved.");
  if (actor.local && !actor.college) throw new Error("Your account needs a college to manage records.");
  const data = { title: values.title, label: values.label, type: values.type, status: values.status, destination_office: values.destinationOffice, working_document: values.workingDocuments[0]?.url ?? "", working_documents: values.workingDocuments, remarks: values.remarks, notify_status_updates: values.notifyStatusUpdates, remark_presets: values.remarkPresets, updated_at: new Date().toISOString(), updated_by: actor.email };
  const table = () => createAdminClient().from(tableName(kind));
  let existing: Numbered | null = null;
  if (id) {
    let lookup = table().select(`${fields},updated_by`).eq("id", id);
    if (kind === "letters") lookup = actor.eventId ? lookup.eq("event_id", actor.eventId) : lookup.is("event_id", null);
    if (actor.local) lookup = lookup.eq("college", actor.college!);
    const { data: found, error } = await lookup.maybeSingle();
    if (error) throw new Error(lettersUnavailable);
    if (!found) throw new Error("This record is unavailable or you don’t have access to it.");
    const current = found as Row & { updated_by: string | null };
    // The browser sends back the timestamp exactly as it was read.
    if (expected && current.updated_at !== expected) throw new RecordConflict(fromRow(current), current.updated_by ?? "");
    existing = current;
  }
  const number = numbering(values, settings, kind, existing);
  let query = id ? table().update({ ...data, ...number }).eq("id", id) : table().insert({ ...data, ...number, college: actor.local ? actor.college : null, created_by: actor.email, prepared_by: actor.name || actor.email, ...(kind === "letters" ? { event_id: actor.eventId ?? null } : {}) });
  if (id && kind === "letters") query = actor.eventId ? query.eq("event_id", actor.eventId) : query.is("event_id", null);
  if (id && actor.local) query = query.eq("college", actor.college!);
  // Someone saving between the check above and this write: it changes nothing, and is read again below.
  if (id && expected) query = query.eq("updated_at", existing!.updated_at);
  const { data: row, error } = await query.select(fields).maybeSingle();
  if (error) throw new Error(lettersUnavailable);
  if (!row && id && expected) return writeLetter(id, values, actor, settings, kind, expected);
  if (!row) throw new Error("This record is unavailable or you don’t have access to it.");
  return fromRow(row as Row);
}

/** Only the authenticated server action supplies the caller's unit scope. */
export async function removeLetter(id: string, scope: LetterScope, kind: TrackerKind = "letters"): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured before records can be deleted.");
  if (scope.local && !scope.college) throw new Error("Your account needs a college to manage records.");
  let query = createAdminClient().from(tableName(kind)).delete().eq("id", id);
  if (kind === "letters") query = scope.eventId ? query.eq("event_id", scope.eventId) : query.is("event_id", null);
  if (scope.local) query = query.eq("college", scope.college!);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error("Couldn’t delete this record. Try again.");
  if (!data) throw new Error("This record is unavailable or you don’t have access to it.");
}

/** Label-only edits never overwrite the letter's other fields or change its status. */
export async function writeLetterLabel(id: string, label: Letter["label"], actor: LetterScope & { email: string }, kind: TrackerKind = "letters"): Promise<Letter> {
  if (!isSupabaseConfigured()) throw new Error("Supabase must be configured before labels can be saved.");
  if (actor.local && !actor.college) throw new Error("Your account needs a college to manage records.");
  let query = createAdminClient().from(tableName(kind)).update({ label, updated_at: new Date().toISOString(), updated_by: actor.email }).eq("id", id);
  if (kind === "letters") query = actor.eventId ? query.eq("event_id", actor.eventId) : query.is("event_id", null);
  if (actor.local) query = query.eq("college", actor.college!);
  const { data, error } = await query.select(fields).maybeSingle();
  if (error) throw new Error(lettersUnavailable);
  if (!data) throw new Error("This record is unavailable or you don’t have access to it.");
  return fromRow(data as Row);
}
