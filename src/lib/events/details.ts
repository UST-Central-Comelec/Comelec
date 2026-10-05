import { z } from "zod";
import { text } from "@/lib/portal/form";
import { backgroundSchema } from "./background";
import { TIME_STEP_MINUTES, venueModes, type EventDetails, type VenueMode } from "./options";

// The rules for an event's details, shared by the event form (src/lib/portal/event-actions.ts) and
// the event details under a unit's Recruitment, Political Party and Filing of Candidacy settings
// (src/lib/portal/period-actions.ts). The form picks times in five-minute steps
// (src/components/portal/time-picker.tsx), and the server holds every time to the same steps.

const onTheStep = (value: string) => Number(value.slice(3)) % TIME_STEP_MINUTES === 0;

const time = (message: string) =>
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, message)
    .refine(onTheStep, `Pick a time on a ${TIME_STEP_MINUTES}-minute mark, like 1:00 or 1:05.`);
const optionalTime = z.union([z.literal(""), time("Use a time like 1:00 PM.")]);

/** The fields of the details, before the checks that compare one with another. */
export const detailFields = {
  name: z.string().trim().min(3, "Add the event’s name.").max(140, "Keep the name under 140 characters."),
  summary: z.string().trim().min(10, "Add a short description (at least 10 characters).").max(300, "Keep the short description under 300 characters."),
  background: backgroundSchema,
  eventDate: z.iso.date("Pick the start date."),
  endDate: z.iso.date("Pick the end date."),
  ingressTime: optionalTime,
  startsTime: time("Set when the activity starts."),
  endsTime: time("Set when the activity ends."),
  egressTime: optionalTime,
  venueMode: z.enum(Object.keys(venueModes) as [VenueMode, ...VenueMode[]], "Pick how it’s held."),
  venueDetails: z.string().trim().min(2, "Add where it’s held.").max(300, "Keep the venue under 300 characters."),
  openToStudents: z.boolean(),
  openToExternals: z.boolean(),
  openToAdmins: z.boolean(),
};

type DetailValues = z.infer<z.ZodObject<typeof detailFields>>;

/** The checks across fields: the times in order, and someone to take part. */
export function checkDetails(value: DetailValues, context: z.RefinementCtx) {
  // "YYYY-MM-DD" and "HH:MM" compare correctly as text. The times only need to be in order on a one-day event.
  if (value.endDate < value.eventDate) context.addIssue({ code: "custom", path: ["endDate"], message: "The end date can’t be before the start date." });
  else if (value.endDate === value.eventDate && value.startsTime >= value.endsTime) context.addIssue({ code: "custom", path: ["endsTime"], message: "On a one-day event, it has to end after it starts." });
  if (value.ingressTime && value.ingressTime > value.startsTime) context.addIssue({ code: "custom", path: ["ingressTime"], message: "Ingress can’t be after the activity starts." });
  if (value.egressTime && value.egressTime < value.endsTime) context.addIssue({ code: "custom", path: ["egressTime"], message: "Egress can’t be before the activity ends." });
  if (!value.openToStudents && !value.openToExternals && !value.openToAdmins) context.addIssue({ code: "custom", path: ["participants"], message: "Tick at least one." });
}

export const detailsSchema = z.object(detailFields).superRefine(checkDetails);

/** The details as the form sent them. */
export function readDetails(formData: FormData) {
  return {
    name: text(formData, "name"),
    summary: text(formData, "summary"),
    background: text(formData, "background"),
    eventDate: text(formData, "eventDate"),
    endDate: text(formData, "endDate"),
    ingressTime: text(formData, "ingressTime"),
    startsTime: text(formData, "startsTime"),
    endsTime: text(formData, "endsTime"),
    egressTime: text(formData, "egressTime"),
    venueMode: text(formData, "venueMode"),
    venueDetails: text(formData, "venueDetails"),
    openToStudents: formData.get("openToStudents") === "on",
    openToExternals: formData.get("openToExternals") === "on",
    openToAdmins: formData.get("openToAdmins") === "on",
  };
}

/** The checked values as the details are saved: an empty optional time is saved as none. */
export const toDetails = <T extends DetailValues>({ ingressTime, egressTime, ...rest }: T): Omit<T, "ingressTime" | "egressTime"> & Pick<EventDetails, "ingressTime" | "egressTime"> => ({ ...rest, ingressTime: ingressTime || null, egressTime: egressTime || null });
