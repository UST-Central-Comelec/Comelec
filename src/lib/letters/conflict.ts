import type { Letter, LetterValues } from "./options";

// Two people editing the same letter or meeting minutes (src/components/portal/letters-tracker.tsx).
// The dialog knows the record as it was opened, as it's been edited, and as the other person saved
// it, so it puts changes to different fields together itself.

const letterKeys = ["title", "label", "type", "status", "controlNumber", "destinationOffice", "workingDocuments", "remarks", "notifyStatusUpdates", "remarkPresets"] as const satisfies ReadonlyArray<keyof LetterValues>;
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The fields, as a conflict names them. */
export const fieldLabels: Record<keyof LetterValues, string> = { title: "Title", label: "Label", type: "Type", status: "Status", controlNumber: "Control Number", destinationOffice: "Destination Office", workingDocuments: "Working Documents", remarks: "Remarks", notifyStatusUpdates: "Notify Status Updates", remarkPresets: "Remarks" };

export const valuesOf = (letter: Letter): LetterValues => ({ title: letter.title, label: letter.label, type: letter.type, status: letter.status, controlNumber: letter.controlNumber, destinationOffice: letter.destinationOffice, workingDocuments: letter.workingDocuments.map(document => ({ ...document })), remarks: letter.remarks, notifyStatusUpdates: letter.notifyStatusUpdates, remarkPresets: [...letter.remarkPresets] });

/**
 * Someone else saved the record this person opened (`opened`). What each of them changed: `theirs`
 * only they changed, `clash` both changed, differently.
 */
export function compareEdits(opened: LetterValues, draft: LetterValues, saved: LetterValues) {
  const mine = letterKeys.filter(key => !sameValue(draft[key], opened[key]));
  const changedByThem = letterKeys.filter(key => !sameValue(saved[key], opened[key]));
  return { theirs: changedByThem.filter(key => !mine.includes(key)), clash: mine.filter(key => changedByThem.includes(key) && !sameValue(saved[key], draft[key])) };
}

/** Puts one field of the record into the form's data, as the form itself would have sent it. */
export function setField(data: FormData, key: keyof LetterValues, value: LetterValues[keyof LetterValues]) {
  // Only a hand-typed control number is sent; the others are made on the server.
  if (key === "controlNumber" && !data.has(key)) return;
  data.delete(key);
  if (key === "workingDocuments") data.set(key, JSON.stringify(value));
  else if (key === "remarkPresets") for (const preset of value as string[]) data.append(key, preset);
  else if (key === "notifyStatusUpdates") { if (value) data.set(key, "on"); }
  else data.set(key, value == null ? "" : String(value));
}
