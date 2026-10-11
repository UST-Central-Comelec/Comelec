import { z } from "zod";
import { containsEmoji } from "@/lib/forms/input";
import { yearLevels, isYearLevelFor } from "@/lib/applications/options";
import { isRoleFor } from "@/lib/data/accounts";
import { accountPositions, affiliations, commissionerPositions, type AccountPosition, type Affiliation } from "@/lib/data/types";
import { applicationFields, programError } from "@/lib/applications/schema";
import { formatAccepted, type Declaration } from "@/lib/onboarding/documents";

// The Request access form: About you from the commissioner application, plus where the requester
// serves (the Central Comelec or their college's Local Comelec), their position there (Executive
// Board, Executive Associate or Deputy) and their role. These become their account when the
// request is approved. Shared by the form (checks before confirming with Google) and the server
// action (checks again before saving).

export const accessRequestFields = applicationFields
  .pick({ lastName: true, firstName: true, middleName: true, studentNumber: true, contactNumber: true, email: true, college: true, program: true, yearLevel: true })
  .extend({
    affiliation: z.enum(Object.keys(affiliations) as [Affiliation, ...Affiliation[]], "Pick Central or Local Comelec."),
    // Commissioners ask for access; advisers and admins are added by the Executive Board.
    position: z.enum(commissionerPositions, "Pick your position."),
    role: z.string().trim().min(1, "Pick your role."),
    // Optional, unlike on the commissioner application.
    facebookUrl: z.union([z.literal(""), applicationFields.shape.facebookUrl]),
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
    middleName: text("middleName"),
    studentNumber: text("studentNumber"),
    contactNumber: text("contactNumber").trim(),
    email: text("email"),
    affiliation: text("affiliation"),
    position: text("position"),
    role: text("role"),
    facebookUrl: text("facebookUrl").trim(),
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
  for (const [field, value] of Object.entries(values)) {
    if (typeof value === "string" && containsEmoji(value)) errors[field] = "Emoji aren’t allowed in this field.";
  }
  if (!errors.program && !errors.college) {
    const message = programError(values);
    if (message) errors.program = message;
  }
  if (!isYearLevelFor(values.college, values.yearLevel)) errors.yearLevel = "Pick a year or grade level from your school’s list.";
  // The role has to be one that position holds in that unit.
  if (!errors.role && !errors.position && !errors.affiliation && !isRoleFor(values.affiliation as Affiliation, values.position as AccountPosition, values.role.trim(), values.college)) errors.role = "Pick your role.";
  return errors;
}

/** Rows are [label, value]. */
export type AccessRequestSection = { title: string; rows: Array<[string, string]> };

/** Every answer in words, for the receipt and the downloaded receipt, with what they agreed to and when. */
export function describeAccessRequest(values: AccessRequestValues, declarations: Declaration[] = []): AccessRequestSection[] {
  return [
    { title: "About you", rows: [
      ["Name", `${values.lastName.trim().toUpperCase()}, ${values.firstName.trim().toUpperCase()} ${values.middleName.trim().toUpperCase()}`],
      ["Student number", values.studentNumber],
      ["Mobile number", values.contactNumber],
      ["UST email", values.email],
      ["College or faculty", values.college],
      ["Program", values.program],
      ["Year level", yearLevels[values.yearLevel as keyof typeof yearLevels] ?? ""],
      ["Facebook", values.facebookUrl],
    ] },
    { title: "Request", rows: [
      ["Serves in", affiliations[values.affiliation as Affiliation] ?? ""],
      ["Position", accountPositions[values.position as AccountPosition] ?? ""],
      ["Role", values.role.trim()],
      ["Access", "Commission Portal"],
    ] },
    ...(declarations.length ? [{ title: "Declarations", rows: declarations.map((item): [string, string] => [item.title, `Accepted ${formatAccepted(item.acceptedAt)}`]) }] : []),
  ];
}
