import { z } from "zod";
import { containsEmoji, personNamePattern } from "@/lib/forms/input";
import { comelecUnits } from "@/lib/applications/options";

const text = z.string().trim().min(1, "Complete this field.").max(250, "Use 250 characters or fewer.").refine((value) => !containsEmoji(value), "Emoji aren’t allowed in this field.");
const name = text.regex(personNamePattern, "Use letters and spaces only.");
const date = z.iso.date("Enter a valid date.");
const email = z.email("Enter a valid email address.").max(254);
const student = text;
const signatory = z.object({ fullName: name, position: text });
const officer = z.object({ position: text, fullName: name, college: text, studentNumber: student, contactNumber: text, email, recruitedAt: date });
const member = officer.omit({ position: true, email: true });
const alumni = z.object({ fullName: name, college: text, yearGraduated: z.string().regex(/^\d{4}$/, "Enter a four-digit graduation year."), contactNumber: text });
const affiliate = z.object({ name: text, college: text, contactPerson: name, contactNumber: text, email });
export const conformeSchema = z.object({
  fullName: name, college: text, studentNumber: student, signedOn: date,
  witness1Name: name, witness1Date: date, witness2Name: name, witness2Date: date,
});
export type Conforme = z.infer<typeof conformeSchema>;
export const partyRegistrationFields = z.object({
  unit: z.string().refine((value) => value === "central" || comelecUnits.includes(value), "Select a commission unit."),
  partyName: text,
  establishedAt: date,
  headquarters: z.string().trim().max(500).refine((value) => !containsEmoji(value), "Emoji aren’t allowed in this field."),
  contactPerson: name,
  contactNumber: text,
  email,
  petitionDate: date,
  petitionSignatory: signatory,
  officers: z.array(officer),
  members: z.array(member),
  alumni: z.array(alumni),
  affiliates: z.array(affiliate),
  // Older submissions stored the signed conformes only as uploaded documents.
  conformes: z.array(conformeSchema).default([]),
  certifications: z.object({ officers: signatory, members: signatory, alumni: signatory, affiliates: signatory }),
  submittedBy: name,
  submittedPosition: z.enum(["Secretary General", "President"], { error: "Select Secretary General or President." }),
  petitionAccepted: z.literal(true, { error: "Confirm the petition declaration." }),
  recordsAccepted: z.literal(true, { error: "Confirm the roster certifications." }),
  conformeAccepted: z.literal(true, { error: "Confirm that the signed conformes include the membership declarations and witnesses." }),
});
export const partyRegistrationSchema = partyRegistrationFields.superRefine((data, ctx) => {
  if (data.unit === "central" && !data.headquarters) ctx.addIssue({ code: "custom", path: ["headquarters"], message: "Enter the principal headquarters for a central party." });
  if (data.petitionDate < data.establishedAt) ctx.addIssue({ code: "custom", path: ["petitionDate"], message: "The petition date cannot precede the party’s establishment." });
});
export type PartyRegistration = z.infer<typeof partyRegistrationSchema>;
export type PartyDocument = { requirement: string; name: string; path: string; size: number; type: string };
export type PartyReceipt = { reference: string; partyName: string; submittedAt: string };
export type PartyResponse = { error?: string; fieldErrors?: Record<string, string>; receipt?: PartyReceipt };

export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[issue.path.join(".")] ??= issue.message;
  return errors;
}
