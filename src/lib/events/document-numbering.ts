import type { RecordType, SecretariatSettings } from "@/lib/letters/settings";
import { activityChecklist, activityDocument, activityDocuments, type VenueType } from "./activity-checklist";

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ids: Record<string, string> = {
  "Project Proposal Form (PPF)": "project-proposal",
  "Community Development Project Proposal Form (Simbahayan)": "community-development-project-proposal",
  "Vehicle Reservation Form": "vehicle-reservation",
  "Budget Proposal": "budget-proposal",
};

const rank = (name: string) => { const index = Object.keys(ids).indexOf(name); return index < 0 ? Object.keys(ids).length : index; };

/**
 * University forms with a printed code (from the e-ReSERVe templates). Their control number is the
 * code plus the event's activity suffix; it never takes the event's counter. Keep in step with
 * public.event_document_form_number (supabase/migrations/20261015000400_event_activity_checklist.sql).
 * The four reserved forms lead, in their original order; the rest follow alphabetically.
 */
export const fixedEventDocumentTypes: RecordType[] = activityDocuments.filter(document => document.code).map(document => ({
  id: ids[document.name] ?? slug(document.name), name: document.name, format: document.code!, autoIncrement: false, universityIssued: true,
})).sort((a, b) => rank(a.name) - rank(b.name));

/** Older names the same forms were saved under. */
const aliases: Record<string, string> = {
  "project proposal": "Project Proposal Form (PPF)", "project proposal form": "Project Proposal Form (PPF)", ppf: "Project Proposal Form (PPF)",
  "community development project proposal form": "Community Development Project Proposal Form (Simbahayan)",
  "community development project proposal": "Community Development Project Proposal Form (Simbahayan)",
  simbahayan: "Community Development Project Proposal Form (Simbahayan)",
  "vehicle reservation": "Vehicle Reservation Form", "accomplished vehicle reservation form": "Vehicle Reservation Form",
  "budget proposal form": "Budget Proposal", "budget proposal form (bpf)": "Budget Proposal", bpf: "Budget Proposal",
};

/** A fixed university form's code, by its id, name, an older name, or its code. */
export function eventDocumentFormNumber(type: Pick<RecordType, "id" | "name" | "format">): string | null {
  const name = type.name.trim().toLowerCase();
  const canonical = (aliases[name] ?? name).toLowerCase();
  const fixed = fixedEventDocumentTypes.find(item => item.id === type.id || item.name.toLowerCase() === canonical)
    ?? fixedEventDocumentTypes.find(item => type.format === item.format || type.format.startsWith(`${item.format} (`));
  return fixed?.format ?? null;
}

/**
 * Whether a type is an official e-ReSERVe document (a checklist document or a university form).
 * Those are only added by the checklist and keep their type; people add letters by hand.
 */
export const isOfficialEventDocument = (name: string) => Boolean(activityDocument(name)) || eventDocumentFormNumber({ id: "", name, format: "" }) !== null;

/** The checklist documents an event can hold: its own checklist's, plus any type it already has. */
export function eventChecklistNames(event: { venueType?: VenueType | null; natureOfActivity?: string | null }, existingTypes: string[] = []): string[] {
  const checklist = event.venueType && event.natureOfActivity ? activityChecklist(event.venueType, event.natureOfActivity).map(document => document.name) : [];
  return [...new Set([...checklist, ...existingTypes])];
}

/**
 * The types an event document can be: the four reserved university forms, the event's own
 * checklist documents (`checklist`, from eventChecklistNames), then the Secretariat's own letter
 * types. Other checklist documents aren't offered. Ordinary documents number on from 05.
 */
export function eventDocumentSettings(settings: SecretariatSettings, eventControlNumber = "", checklist: string[] = []): SecretariatSettings {
  const activity = eventControlNumber.split("-").at(-1);
  const wanted = new Set(checklist.map(name => name.toLowerCase()));
  const counted = (name: string): RecordType => ({ id: slug(name), name, format: eventControlNumber, autoIncrement: true, universityIssued: false });
  const types = [
    ...fixedEventDocumentTypes.filter(type => type.name in ids || wanted.has(type.name.toLowerCase())).map(type => ({ ...type, format: `${type.format}${eventControlNumber ? ` (${activity})` : ""}` })),
    ...activityDocuments.filter(document => !document.code && wanted.has(document.name.toLowerCase())).map(document => counted(document.name)),
    ...settings.letters.types.filter(type => !eventDocumentFormNumber(type)).map(type => ({ ...type, universityIssued: false, autoIncrement: true, format: eventControlNumber })),
  ];
  const seen = new Set<string>();
  return { ...settings, letters: { autoIncrement: true, types: types.filter(type => !seen.has(type.name.toLowerCase()) && seen.add(type.name.toLowerCase())) } };
}
