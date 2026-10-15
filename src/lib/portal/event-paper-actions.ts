"use server";

import { unstable_rethrow } from "next/navigation";
import { requireEditor, isLocal } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import type { Letter, LetterSaveResult } from "@/lib/letters/options";
import { getEventDocumentNumberPreview, saveEventDocument, deleteEventDocument, setEventDocumentLabel } from "./event-document-actions";

/** Resolve the stored parent; the event actions independently enforce Events access and ownership. */
async function eventForPaper(id: string) {
  const user = await requireEditor("secretariat/letters-tracker");
  let query = createAdminClient().from("secretariat_letters").select("event_id").eq("id", id);
  if (isLocal(user)) {
    if (!user.college) throw new Error("Your account needs a college to manage event papers.");
    query = query.eq("college", user.college);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data?.event_id) throw new Error("This event paper is unavailable. Reload the tracker and try again.");
  return data.event_id as string;
}

export async function getEventPaperNumberPreview(type: string, id?: string): Promise<{ controlNumber: string; error?: never } | { controlNumber?: never; error: string }> {
  if (!id) return { error: "Open an event paper before requesting its document number." };
  try {
    return await getEventDocumentNumberPreview(await eventForPaper(id), type);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Couldn’t load the document number. Try again." };
  }
}

export async function saveEventPaper(id: string | null, form: FormData): Promise<LetterSaveResult> {
  if (!id) return { error: "Add documents from the event’s Documentations tab." };
  try {
    const eventId = await eventForPaper(id);
    const result = await saveEventDocument(eventId, id, form);
    return result;
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Couldn’t save this event paper. Try again." };
  }
}

export async function deleteEventPaper(id: string): Promise<{ success: true; error?: never } | { success?: never; error: string }> {
  try {
    const eventId = await eventForPaper(id);
    return await deleteEventDocument(eventId, id);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Couldn’t delete this event paper. Try again." };
  }
}

export async function setEventPaperLabel(id: string, label: Letter["label"]): Promise<LetterSaveResult> {
  try {
    const eventId = await eventForPaper(id);
    return await setEventDocumentLabel(eventId, id, label);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Couldn’t save this label. Try again." };
  }
}
