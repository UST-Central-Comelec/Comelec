"use server";

import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/auth/session";
import { recordSchema, type Letter, type LetterSaveResult } from "@/lib/letters/options";
import { eventChecklistNames, eventDocumentSettings, isOfficialEventDocument } from "@/lib/events/document-numbering";
import { getSecretariatSettings } from "@/lib/letters/settings-store";
import { saverName } from "@/lib/data/edit-guard";
import { listLetters, previewEventDocumentControlNumber, RecordConflict, removeLetter, writeLetter, writeLetterLabel } from "@/lib/letters/store";
import { text } from "./form";
import { getEvent } from "@/lib/events/queries";
import { canManageEvent } from "@/lib/events/access";

/** Check event ownership before any read, numbering preview or mutation. */
async function documentEditor(eventId: string) {
  const user = await requireEditor("events");
  const event = await getEvent(eventId);
  if (!event || !canManageEvent(user, event)) throw new Error("You don’t have access to manage this event’s documents.");
  return { user, event, scope: { local: event.organizer === "local", college: event.college, eventId: event.id } };
}

/** The event's checklist documents, plus types its documents already have, so those stay editable. */
async function checklistOf(event: NonNullable<Awaited<ReturnType<typeof getEvent>>>, scope: { local: boolean; college: string | null; eventId: string }, letters?: Letter[]) {
  return eventChecklistNames(event, (letters ?? await listLetters(scope)).map(letter => letter.type));
}

/** Preview the event’s next document number or a university form’s fixed activity suffix. */
export async function getEventDocumentNumberPreview(eventId: string, type: string): Promise<{ controlNumber: string; error?: never } | { controlNumber?: never; error: string }> {
  const { event, scope } = await documentEditor(eventId);
  try {
    const { settings } = await getSecretariatSettings();
    if (!eventDocumentSettings(settings, "", await checklistOf(event, scope)).letters.types.some(item => item.name === type)) return { error: "Choose a document type from the list." };
    return { controlNumber: await previewEventDocumentControlNumber(eventId, type) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t load the next control number." };
  }
}

export async function saveEventDocument(eventId: string, id: string | null, formData: FormData): Promise<LetterSaveResult> {
  const { user, event, scope } = await documentEditor(eventId);
  if (id !== null && (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return { error: "Unknown document." };
  let documents: unknown;
  try { documents = JSON.parse(text(formData, "workingDocuments") || "[]"); }
  catch { return { error: "Couldn’t read document links.", fieldErrors: { workingDocuments: "Check your document links and try again." } }; }
  let settings;
  try { ({ settings } = await getSecretariatSettings()); }
  catch (error) { return { error: error instanceof Error ? error.message : "Couldn’t load the Secretariat settings." }; }
  if (!event.controlNumber) return { error: "Apply the event_control_numbers migration, then reload this event before saving documents." };
  let current: Letter | undefined;
  try {
    const letters = await listLetters(scope);
    current = id ? letters.find(letter => letter.id === id) : undefined;
    settings = eventDocumentSettings(settings, event.controlNumber, await checklistOf(event, scope, letters));
  } catch (error) { return { error: error instanceof Error ? error.message : "Couldn’t load this event’s documents." }; }
  // Official checklist documents are added for the event and keep their type; by hand, only letters.
  const sentType = text(formData, "type");
  if (current && isOfficialEventDocument(current.type) ? sentType !== current.type : isOfficialEventDocument(sentType)) {
    return { error: "Check the highlighted fields.", fieldErrors: { type: current && isOfficialEventDocument(current.type) ? "Checklist documents keep their type." : "Choose a letter type. The checklist’s documents are added for you." } };
  }
  const result = recordSchema(settings, "letters").safeParse({ ...Object.fromEntries(["title", "type", "status", "controlNumber", "destinationOffice", "remarks"].map(key => [key, text(formData, key)])), label: text(formData, "label") || null, workingDocuments: documents, notifyStatusUpdates: formData.get("notifyStatusUpdates") === "on", remarkPresets: formData.getAll("remarkPresets") });
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  let letter;
  try {
    letter = await writeLetter(id, result.data, { ...scope, email: user.email, name: user.name }, settings, "letters", text(formData, "_expected") || null);
  } catch (error) {
    if (error instanceof RecordConflict) {
      const by = await saverName(error.by, user.email);
      return { error: by === "You" ? "You saved this document in another tab while editing here, so this wasn’t saved." : `${by} saved this document while you were editing, so yours wasn’t saved.`, conflict: { letter: error.letter, by } };
    }
    return { error: error instanceof Error ? error.message : "Couldn’t save this document. Try again." };
  }
  revalidatePath(`/portal/events/${eventId}/documentations`);
  revalidatePath("/portal/secretariat/letters-tracker");
  revalidatePath("/portal", "layout");
  return { letter };
}

export async function deleteEventDocument(eventId: string, id: string): Promise<{ success: true; error?: never } | { success?: never; error: string }> {
  const { scope } = await documentEditor(eventId);
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: "Unknown document." };
  try {
    await removeLetter(id, scope);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t delete this document. Try again." };
  }
  revalidatePath(`/portal/events/${eventId}/documentations`);
  revalidatePath("/portal/secretariat/letters-tracker");
  return { success: true };
}

export async function setEventDocumentLabel(eventId: string, id: string, label: Letter["label"]): Promise<LetterSaveResult> {
  const { user, scope } = await documentEditor(eventId);
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: "Unknown document." };
  let letter;
  try {
    const { settings } = await getSecretariatSettings();
    if (label !== null && (typeof label !== "string" || !settings.labels.some(item => item.name === label))) return { error: "Choose a valid label." };
    letter = await writeLetterLabel(id, label, { ...scope, email: user.email });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save this label. Try again." };
  }
  revalidatePath(`/portal/events/${eventId}/documentations`);
  revalidatePath("/portal/secretariat/letters-tracker");
  return { letter };
}
