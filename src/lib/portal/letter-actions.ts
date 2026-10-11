"use server";

import { revalidatePath } from "next/cache";
import { isLocal, requireEditor } from "@/lib/auth/session";
import { recordSchema, type Letter, type LetterSaveResult } from "@/lib/letters/options";
import { numberMode } from "@/lib/letters/settings";
import { getSecretariatSettings } from "@/lib/letters/settings-store";
import { previewControlNumber, removeLetter, writeLetter, writeLetterLabel } from "@/lib/letters/store";
import { text } from "./form";

/** The next automatic number for this type, or an error when the type isn't numbered automatically. */
export async function getLetterNumberPreview(type: string): Promise<{ controlNumber: string; error?: never } | { controlNumber?: never; error: string }> {
  await requireEditor("secretariat/letters-tracker");
  try {
    const { settings } = await getSecretariatSettings();
    const found = settings.letters.types.find(item => item.name === type);
    if (!found || numberMode(settings.letters, found) !== "auto") return { error: "This type isn’t numbered automatically." };
    return { controlNumber: await previewControlNumber(found.format) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t load the next control number." };
  }
}

export async function saveLetter(id: string | null, formData: FormData): Promise<LetterSaveResult> {
  const user = await requireEditor("secretariat/letters-tracker");
  if (id !== null && (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return { error: "Unknown letter." };
  let documents: unknown;
  try { documents = JSON.parse(text(formData, "workingDocuments") || "[]"); }
  catch { return { error: "Couldn’t read document links.", fieldErrors: { workingDocuments: "Check your document links and try again." } }; }
  let settings;
  try { ({ settings } = await getSecretariatSettings()); }
  catch (error) { return { error: error instanceof Error ? error.message : "Couldn’t load the Secretariat settings." }; }
  const result = recordSchema(settings, "letters").safeParse({ ...Object.fromEntries(["title", "type", "status", "controlNumber", "destinationOffice", "remarks"].map(key => [key, text(formData, key)])), label: text(formData, "label") || null, workingDocuments: documents, notifyStatusUpdates: formData.get("notifyStatusUpdates") === "on", remarkPresets: formData.getAll("remarkPresets") });
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { error: "Check the highlighted fields.", fieldErrors };
  }
  let letter;
  try {
    letter = await writeLetter(id, result.data, { email: user.email, name: user.name, local: isLocal(user), college: user.college }, settings);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save this letter. Try again." };
  }
  revalidatePath("/portal/secretariat/letters-tracker");
  revalidatePath("/portal", "layout");
  return { letter };
}

export async function deleteLetter(id: string): Promise<{ success: true; error?: never } | { success?: never; error: string }> {
  const user = await requireEditor("secretariat/letters-tracker");
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: "Unknown letter." };
  try {
    await removeLetter(id, { local: isLocal(user), college: user.college });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t delete this letter. Try again." };
  }
  revalidatePath("/portal/secretariat/letters-tracker");
  return { success: true };
}

export async function setLetterLabel(id: string, label: Letter["label"]): Promise<LetterSaveResult> {
  const user = await requireEditor("secretariat/letters-tracker");
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: "Unknown letter." };
  let letter;
  try {
    const { settings } = await getSecretariatSettings();
    if (label !== null && (typeof label !== "string" || !settings.labels.some(item => item.name === label))) return { error: "Choose a valid label." };
    letter = await writeLetterLabel(id, label, { email: user.email, local: isLocal(user), college: user.college });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save this label. Try again." };
  }
  revalidatePath("/portal/secretariat/letters-tracker");
  return { letter };
}
