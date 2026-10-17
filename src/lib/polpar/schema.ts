import { z } from "zod";
import { containsEmoji, titleCaseText } from "@/lib/forms/input";
import { email as emailField, mobileNumber, personName, studentNumber } from "@/lib/forms/fields";
import { comelecUnits } from "@/lib/applications/options";

const text = z.string().trim().min(1, "Complete this field.").max(250, "Use 250 characters or fewer.").refine((value) => !containsEmoji(value), "Emoji aren’t allowed in this field.");
const titledText = text.transform(titleCaseText);
// People's names, student numbers, mobile numbers and emails follow the rules every form does (src/lib/forms/fields.ts).
const name = personName("Complete this field.", 120);
const date = z.iso.date("Enter a valid date.");
const email = emailField();
const student = studentNumber();
const mobile = mobileNumber();
const signatory = z.object({ fullName: name, position: titledText });
const officer = z.object({ position: titledText, fullName: name, college: titledText, studentNumber: student, contactNumber: mobile, email, recruitedAt: date });
const member = officer.omit({ position: true, email: true });
const alumni = z.object({ fullName: name, college: titledText, yearGraduated: z.string().regex(/^\d{4}$/, "Enter a four-digit graduation year."), contactNumber: mobile });
const affiliate = z.object({ name: titledText, college: titledText, contactPerson: name, contactNumber: mobile, email });
export const conformeSchema = z.object({
  fullName: name, college: titledText, studentNumber: student, signedOn: date,
  witness1Name: name, witness1Date: date, witness2Name: name, witness2Date: date,
});
export type Conforme = z.infer<typeof conformeSchema>;
export const partyRegistrationFields = z.object({
  unit: z.string().refine((value) => value === "central" || comelecUnits.includes(value), "Select a commission unit."),
  partyName: text.transform(value => value.toLocaleUpperCase("en-PH")),
  establishedAt: date,
  headquarters: z.string().trim().max(500).refine((value) => !containsEmoji(value), "Emoji aren’t allowed in this field.").transform(titleCaseText),
  contactPerson: name,
  contactNumber: mobile,
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
// `store` marks documents kept in R2; older ones, without it, sit in the Supabase `party-registration` bucket.
export type PartyDocument = { requirement: string; name: string; path: string; size: number; type: string; store?: "r2" };
export type PartyReceipt = { reference: string; partyName: string; submittedAt: string };
export type PartyResponse = { error?: string; fieldErrors?: Record<string, string>; receipt?: PartyReceipt };

export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[issue.path.join(".")] ??= issue.message;
  return errors;
}
