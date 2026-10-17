import { applicationFields, programError } from "@/lib/applications/schema";
import { isYearLevelFor } from "@/lib/applications/options";
import { mobileNumber } from "@/lib/forms/fields";
import type { z } from "zod";

// The filing portal's sign-up forms (Political Party Registration, Filing of Candidacy): who the
// person is, then the application. Shared by the forms, which check each step before moving on, and
// the server actions, which check everything again before saving. People's names, student numbers,
// mobile numbers and emails follow every form's rules (src/lib/forms/fields.ts).

/** About you: the same rules as the commissioner application's, with the mobile number required. */
export const profileFields = applicationFields
  .pick({ lastName: true, firstName: true, middleName: true, studentNumber: true, college: true, program: true, yearLevel: true, facebookUrl: true })
  .extend({ contactNumber: mobileNumber() });

/** Every answer either form sends, as typed: each a string until it's checked. */
export type SignUpValues = {
  lastName: string; firstName: string; middleName: string; studentNumber: string; contactNumber: string; facebookUrl: string; college: string; program: string; yearLevel: string;
  /** Political Party Registration: the party joined, or the new one's details. */
  partyId: string; partyName: string; unit: string; establishedAt: string; headquarters: string;
  /** Filing of Candidacy: the office, and the party it runs under ("" for an independent). */
  position: string; runningFor: string; candidacyParty: string; dateOfBirth: string; residence: string;
  consent: boolean; oath: boolean;
};

export function readSignUp(formData: FormData): SignUpValues {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  return {
    lastName: text("lastName"), firstName: text("firstName"), middleName: text("middleName"),
    studentNumber: text("studentNumber"), contactNumber: text("contactNumber"), facebookUrl: text("facebookUrl"),
    college: text("college"), program: text("program"), yearLevel: text("yearLevel"),
    partyId: text("partyId"), partyName: text("partyName"), unit: text("unit"), establishedAt: text("establishedAt"), headquarters: text("headquarters"),
    position: text("position"), runningFor: text("runningFor"), candidacyParty: text("candidacyParty"), dateOfBirth: text("dateOfBirth"), residence: text("residence"),
    consent: formData.has("consent"), oath: formData.has("oath"),
  };
}

export const firstErrors = (error: z.ZodError) => {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[issue.path.join(".")] ??= issue.message;
  return errors;
};

/** What's wrong with About you, by field. */
export function profileErrors(values: SignUpValues) {
  const parsed = profileFields.safeParse(values);
  const errors = parsed.success ? {} : firstErrors(parsed.error);
  if (!errors.college) {
    const program = programError(values);
    if (program) errors.program ??= program;
    if (!isYearLevelFor(values.college, values.yearLevel)) errors.yearLevel ??= "Pick a year or grade level from your school’s list.";
  }
  return errors;
}

/** Today in Manila, as a date (2026-10-17). */
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
