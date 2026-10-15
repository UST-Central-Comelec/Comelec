import "server-only";

import { getSecretariatSettings } from "@/lib/letters/settings-store";
import { listLetters, writeLetter } from "@/lib/letters/store";
import { activityChecklist } from "./activity-checklist";
import { eventChecklistNames, eventDocumentSettings } from "./document-numbering";
import type { CommissionEvent } from "./options";

const DEFAULT_OFFICE = "Office for Student Affairs (OSA)";

/**
 * Adds the e-ReSERVe checklist for the event's venue type and nature of activity to its
 * Documentations, skipping any type it already has. Nothing is removed when the activity changes.
 * Documents are added one at a time so their numbers follow the checklist's order. Returns how many
 * were added.
 */
export async function addChecklistDocuments(event: CommissionEvent, actor: { email: string; name: string }): Promise<number> {
  if (!event.venueType || !event.natureOfActivity || !event.controlNumber) return 0;
  const checklist = activityChecklist(event.venueType, event.natureOfActivity);
  if (!checklist.length) return 0;
  const scope = { local: event.organizer === "local", college: event.college, eventId: event.id };
  const [{ settings: base }, existing] = await Promise.all([getSecretariatSettings(), listLetters(scope)]);
  const settings = eventDocumentSettings(base, event.controlNumber, eventChecklistNames(event));
  const status = base.statuses[0]?.name;
  if (!status) return 0;
  const have = new Set(existing.map(letter => letter.type.toLowerCase()));
  let added = 0;
  for (const document of checklist) {
    const type = settings.letters.types.find(item => item.name.toLowerCase() === document.name.toLowerCase());
    if (!type || have.has(type.name.toLowerCase())) continue;
    await writeLetter(null, {
      title: document.name, label: null, type: type.name, status, controlNumber: "",
      destinationOffice: document.office ?? DEFAULT_OFFICE, workingDocuments: [], notifyStatusUpdates: false, remarkPresets: [],
      remarks: document.required ? "" : "Optional on the e-ReSERVe checklist.",
    }, { ...scope, email: actor.email, name: actor.name || actor.email }, settings);
    have.add(type.name.toLowerCase());
    added++;
  }
  return added;
}
