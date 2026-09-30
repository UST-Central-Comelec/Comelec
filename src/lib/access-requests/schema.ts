import { z } from "zod";
import { yearLevels } from "@/lib/applications/options";
import { affiliations, type Affiliation } from "@/lib/data/types";
import { applicationFields, programError } from "@/lib/applications/schema";

// The Request access form: About you from the commissioner application, plus the requester's
// position and whether they serve in the Central Comelec or their college's Local Comelec. Shared by the form (checks before confirming with Google) and the server action
// (checks again before saving).

export const accessRequestFields = applicationFields
  .pick({ lastName: true, firstName: true, middleInitial: true, studentNumber: true, contactNumber: true, email: true, college: true, program: true, yearLevel: true })
  .extend({
    position: z.string().trim().min(2, "Add your position in the commission.").max(120, "Keep it under 120 characters."),
    affiliation: z.enum(Object.keys(affiliations) as [Affiliation, ...Affiliation[]], "Pick Central or Local Comelec."),
  });

export type AccessRequestValues = ReturnType<typeof readAccessRequest>;

export function readAccessRequest(formData: FormData) {
  const text = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return {
    lastName: text("lastName"),
    firstName: text("firstName"),
    middleInitial: text("middleInitial"),
    studentNumber: text("studentNumber"),
    contactNumber: text("contactNumber").trim(),
    email: text("email"),
    position: text("position"),
    affiliation: text("affiliation"),
    college: text("college"),
    program: text("program"),
    yearLevel: text("yearLevel"),
  };
}

/** A message per invalid field; empty when everything is valid. */
export function checkAccessRequest(values: AccessRequestValues) {
  const result = accessRequestFields.safeParse(values);
  const errors: Record<string, string> = {};
  if (!result.success) for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  if (!errors.program && !errors.college) {
    const message = programError(values);
    if (message) errors.program = message;
  }
  return errors;
}

/** Rows are [label, value]. */
export type AccessRequestSection = { title: string; rows: Array<[string, string]> };

/** Every answer in words, for the receipt and the downloaded receipt. */
export function describeAccessRequest(values: AccessRequestValues): AccessRequestSection[] {
  return [
    { title: "About you", rows: [
      ["Name", `${values.lastName.toUpperCase()}, ${values.firstName.toUpperCase()} ${values.middleInitial.toUpperCase()}.`],
      ["Student number", values.studentNumber],
      ["Mobile number", values.contactNumber],
      ["UST email", values.email],
      ["College or faculty", values.college],
      ["Program", values.program],
      ["Year level", yearLevels[values.yearLevel as keyof typeof yearLevels] ?? ""],
    ] },
    { title: "Request", rows: [
      ["Serves in", affiliations[values.affiliation as Affiliation] ?? ""],
      ["Position", values.position.trim()],
      ["Access", "Commission Portal"],
    ] },
  ];
}
