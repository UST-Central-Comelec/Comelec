import { z } from "zod";

/**
 * Secretariat → Settings: what the Letters Tracker and Minutes of the Meetings offer. Saved as one
 * row (public.secretariat_settings, read by ./settings-store.ts); these defaults stand until then.
 * Records store names, not ids. Renaming an item in Settings renames it on every record, which
 * is why each item keeps an id.
 *
 * Free of server-only imports: the trackers and the settings page read the same rules.
 */
export type TrackerKind = "letters" | "minutes";

export const tones = ["blue", "gold", "teal", "green", "orange", "red", "purple", "grey"] as const;
export type Tone = (typeof tones)[number];
export const toneLabels: Record<Tone, string> = { blue: "Blue", gold: "Gold", teal: "Teal", green: "Green", orange: "Orange", red: "Red", purple: "Purple", grey: "Grey" };

/**
 * A letter or minutes type and how its control number is made:
 *   university-issued: `format` is the whole number, the same on every record (UST:S030-00-FO120);
 *   automatic: `format` gets -001, -002, … appended, counted per format;
 *   neither: whoever adds the record types the number.
 * The tracker's own switch, when off, makes every type that isn't university-issued typed by hand.
 */
export type RecordType = { id: string; name: string; format: string; autoIncrement: boolean; universityIssued: boolean };
export type TrackerSettings = { autoIncrement: boolean; types: RecordType[] };
export type ToneItem = { id: string; name: string; tone: Tone };
export type NamedItem = { id: string; name: string };
export type SecretariatSettings = {
  letters: TrackerSettings;
  minutes: TrackerSettings;
  labels: ToneItem[];
  statuses: ToneItem[];
  remarkPresets: NamedItem[];
};

/** Collapses runs of spaces and trims both ends, so pasted names don't carry stray spaces. */
export const cleanText = (value: string) => value.replace(/\s+/g, " ").trim();

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const automatic = (name: string, format: string): RecordType => ({ id: slug(name), name, format, autoIncrement: true, universityIssued: false });
const issued = (name: string, format: string): RecordType => ({ id: slug(name), name, format, autoIncrement: false, universityIssued: true });
const toned = (name: string, tone: Tone): ToneItem => ({ id: slug(name), name, tone });

export const LETTER_FORMAT = "UST:CC-{YYY}-LTR";
export const MINUTE_FORMAT = "UST:CC-{YYY}-MIN";

export const defaultSecretariatSettings: SecretariatSettings = {
  letters: {
    autoIncrement: true,
    types: [
      ...["Request Letter", "Invitation Letter", "Attestation Letter", "Excuse Letter", "Cover Letter", "Courtesy Letter", "Partnership Letter", "Sponsorship Letter", "Narrative Report"].map(name => automatic(name, LETTER_FORMAT)),
      issued("Project Proposal", "UST:S030-00-FO120"),
      issued("Budget Proposal", "UST:S030-00-FO130"),
    ],
  },
  minutes: { autoIncrement: true, types: [automatic("Minutes of the Meeting", MINUTE_FORMAT)] },
  labels: [toned("Priority", "red"), toned("Print", "green"), toned("Follow-up", "blue"), toned("Revise", "orange")],
  statuses: [toned("Draft", "blue"), toned("For Signing", "gold"), toned("Signed", "teal"), toned("Approved", "green"), toned("Discarded", "grey"), toned("Rejected", "red")],
  remarkPresets: ["Print hard copy (Colored) - copy for recipient", "Print hard copy (Monochrome) - copy as receiving copy", "Signed in Person (Wet Signature)", "Send to email"].map(name => ({ id: slug(name), name })),
};

export type NumberMode = "auto" | "fixed" | "manual";

export function numberMode(tracker: TrackerSettings, type: RecordType | undefined): NumberMode {
  if (!type) return "manual";
  if (type.universityIssued) return "fixed";
  return tracker.autoIncrement && type.autoIncrement ? "auto" : "manual";
}

/** {YYY} is the year's last three digits (026 for 2026) and {YYYY} the whole year, in Manila. */
export function renderControlFormat(format: string, at = new Date()): string {
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric" }).format(at);
  return format.replaceAll("{YYYY}", year).replaceAll("{YYY}", year.slice(-3).padStart(3, "0"));
}

export const controlNumber = (format: string, sequence: number, at = new Date()) => `${renderControlFormat(format, at)}-${String(sequence).padStart(3, "0")}`;

const id = z.string().regex(/^[\w-]{1,64}$/, "Unknown item.");
const name = (noun: string) => z.string().transform(cleanText).pipe(z.string().min(1, `Enter a ${noun} name.`).max(100, `Keep the ${noun} name within 100 characters.`));
const recordTypeSchema = z.object({
  id,
  name: name("type"),
  format: z.string().transform(cleanText),
  autoIncrement: z.boolean(),
  universityIssued: z.boolean(),
}).transform(type => type.universityIssued ? type : { ...type, format: type.format.replace(/[\s-]+$/, "") }).superRefine((type, context) => {
  // Automatic numbers add up to seven characters (-001 … -999999) to the format.
  const max = type.universityIssued ? 100 : 90;
  if (!type.format) context.addIssue({ code: "custom", path: ["format"], message: type.universityIssued ? "Enter the university-issued number." : "Enter a control number format." });
  else if (type.format.length > max) context.addIssue({ code: "custom", path: ["format"], message: `Keep the format within ${max} characters.` });
});

/** No two items in a list may share a name (ignoring case) or an id. */
function unique<Item extends { id: string; name: string }>(items: Item[], context: z.RefinementCtx, noun: string) {
  const names = new Set<string>();
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const key = item.name.toLowerCase();
    if (names.has(key)) context.addIssue({ code: "custom", path: [index, "name"], message: `Another ${noun} already has this name.` });
    if (ids.has(item.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Unknown item." });
    names.add(key);
    ids.add(item.id);
  });
}
const list = <Schema extends z.ZodType<{ id: string; name: string }>>(item: Schema, noun: string, min: number, max: number) =>
  z.array(item).min(min, `Keep at least one ${noun}.`).max(max, `Keep up to ${max} items.`).superRefine((items, context) => unique(items, context, noun));
const trackerSchema = z.object({ autoIncrement: z.boolean(), types: list(recordTypeSchema, "type", 1, 50) });
const tonedSchema = (noun: string) => z.object({ id, name: name(noun), tone: z.enum(tones) });
const namedSchema = (noun: string) => z.object({ id, name: name(noun) });

export const secretariatSettingsSchema = z.object({
  letters: trackerSchema,
  minutes: trackerSchema,
  labels: list(tonedSchema("label"), "label", 0, 20),
  statuses: list(tonedSchema("status"), "status", 1, 20),
  remarkPresets: list(namedSchema("remark"), "remark", 0, 30),
});

export type SettingsChange = { kind: "letterType" | "minuteType" | "status" | "label" | "remark"; from: string; to: string };
export type SettingsRemoval = { kind: SettingsChange["kind"]; name: string };

/** What saving `next` over `previous` does to records: names to carry over, and names that go. */
export function settingsChanges(previous: SecretariatSettings, next: SecretariatSettings): { renamed: SettingsChange[]; removed: SettingsRemoval[] } {
  const renamed: SettingsChange[] = [];
  const removed: SettingsRemoval[] = [];
  const compare = (kind: SettingsChange["kind"], before: Array<{ id: string; name: string }>, after: Array<{ id: string; name: string }>) => {
    for (const item of before) {
      const kept = after.find(other => other.id === item.id);
      // An item deleted and added back under the same name keeps its records.
      if (!kept) { if (!after.some(other => other.name === item.name)) removed.push({ kind, name: item.name }); }
      else if (kept.name !== item.name) renamed.push({ kind, from: item.name, to: kept.name });
    }
  };
  compare("letterType", previous.letters.types, next.letters.types);
  compare("minuteType", previous.minutes.types, next.minutes.types);
  compare("status", previous.statuses, next.statuses);
  compare("label", previous.labels, next.labels);
  compare("remark", previous.remarkPresets, next.remarkPresets);
  return { renamed, removed };
}
