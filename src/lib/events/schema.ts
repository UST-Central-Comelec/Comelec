import { z } from "zod";
import { applicationFields, programError } from "@/lib/applications/schema";
import { MAX_ORGANIZATIONS, ORGANIZATION_MAX_LENGTH, sexes, type Sex } from "./options";

// The event registration form's rules. Shared by the form (checks before sending) and the server
// action (checks everything again before saving). Name, student number, college, program and year
// level follow the commissioner application's rules.

export const registrationFields = applicationFields.pick({ lastName: true, firstName: true, studentNumber: true, college: true, program: true, yearLevel: true }).extend({
  // Optional: not everyone has a middle name.
  middleInitial: z.string().trim().regex(/^\p{L}?$/u, "Use one letter only."),
  sex: z.enum(Object.keys(sexes) as [Sex, ...Sex[]], "Pick one."),
  organizations: z
    .array(z.string().trim().min(2, "Each organization needs at least two characters.").max(ORGANIZATION_MAX_LENGTH, `Keep each organization under ${ORGANIZATION_MAX_LENGTH} characters.`))
    .max(MAX_ORGANIZATIONS, `List up to ${MAX_ORGANIZATIONS} organizations.`),
  interest: z.enum(["1", "2", "3", "4", "5"], "Pick how interested you are."),
  consent: z.literal(true, "You need to agree before we can save your registration."),
});

export type RegistrationField = keyof typeof registrationFields.shape;
export type RegistrationValues = ReturnType<typeof readRegistration>;

/** The same organization typed twice, in any capitals or spacing, counts once. */
export function uniqueOrganizations(names: string[]) {
  const seen = new Set<string>();
  return names
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Reads the form's values into the shape the rules expect. */
export function readRegistration(formData: FormData) {
  const text = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return {
    lastName: text("lastName"),
    firstName: text("firstName"),
    middleInitial: text("middleInitial"),
    studentNumber: text("studentNumber"),
    sex: text("sex"),
    college: text("college"),
    program: text("program"),
    yearLevel: text("yearLevel"),
    organizations: uniqueOrganizations(formData.getAll("organizations").filter((value): value is string => typeof value === "string")),
    interest: text("interest"),
    consent: formData.get("consent") === "on",
  };
}

/** A message per invalid field; empty when everything is valid. */
export function checkRegistration(values: RegistrationValues) {
  const result = registrationFields.safeParse(values);
  const errors: Record<string, string> = {};
  if (!result.success) for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  if (!errors.program && !errors.college) {
    const message = programError(values);
    if (message) errors.program = message;
  }
  return errors;
}
