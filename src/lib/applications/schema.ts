import { z } from "zod";
import { colleges, divisions, portfolioDivisions, preferredBodies, programsByCollege, yearLevels, type College, type DivisionId, type SlotCounts } from "./options";

// Shared by the form (checks each step before moving on) and the server action (checks
// everything again before saving).

const keys = <T extends object>(record: T) => Object.keys(record) as [keyof T & string, ...(keyof T & string)[]];
const driveLink = (message: string) => z.string().trim().max(500).regex(/^https:\/\/(drive|docs)\.google\.com\/\S+$/, message);
const name = (message: string) => z.string().trim().min(1, message).max(80).regex(/^[\p{L}][\p{L}\p{M} .'-]*$/u, "Use letters only.");

/** Field rules, one per input. `.pick()` checks a single step's fields. */
export const applicationFields = z.object({
  lastName: name("Add your last name."),
  firstName: name("Add your first name."),
  middleInitial: z.string().trim().min(1, "Add your middle initial.").regex(/^\p{L}$/u, "Use one letter only."),
  studentNumber: z.string().trim().regex(/^\d{10}$/, "Use your 10-digit student number."),
  contactNumber: z.string().trim().regex(/^(\+63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}$/, "Use a mobile number like 0917 123 4567."),
  email: z.string().trim().toLowerCase().email("Use a valid email address.").max(120).refine((value) => value.endsWith("@ust.edu.ph"), "Use your @ust.edu.ph email."),
  college: z.enum(colleges as [College, ...College[]], "Pick your college or faculty from the list."),
  program: z.string().trim().min(1, "Pick your program."),
  yearLevel: z.enum(keys(yearLevels), "Pick your year level."),
  facebookUrl: z.string().trim().max(300).regex(/^(https?:\/\/)?(www\.|m\.|web\.)?(facebook|fb)\.com\/\S+$/i, "Use your Facebook profile link, like facebook.com/yourname."),
  preferredBody: z.enum(keys(preferredBodies), "Pick where you’d like to serve."),
  division: z.enum(keys(divisions), "Pick the division you’re applying to."),
  position: z.string().min(1, "Pick the position you’re applying for."),
  cvUrl: driveLink("Paste the Google Drive link to your CV or résumé."),
  endorsementUrl: z.union([z.literal(""), driveLink("Use a Google Drive link.")]),
  portfolioUrl: z.union([z.literal(""), driveLink("Use a Google Drive link.")]),
  consent: z.literal(true, "You need to agree before we can process your application."),
});

export type ApplicationField = keyof typeof applicationFields.shape;
export type ApplicationValues = ReturnType<typeof readApplication>;

/** The program has to be one the chosen college offers. */
export function programError(values: Pick<ApplicationValues, "college" | "program">) {
  const programs: readonly string[] = programsByCollege[values.college as College] ?? [];
  return values.program && !programs.includes(values.program) ? "Pick a program from your college’s list." : null;
}

export function needsPortfolio(division: string) {
  return portfolioDivisions.includes(division as DivisionId);
}

/** Checks the given fields and returns a message per invalid field (empty when all are valid). */
export function checkFields(values: ApplicationValues, fields: ApplicationField[], slots?: SlotCounts) {
  const mask = Object.fromEntries(fields.map((field) => [field, true])) as Partial<Record<ApplicationField, true>>;
  const result = applicationFields.pick(mask).safeParse(values);
  const errors: Record<string, string> = {};
  if (!result.success) for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  if (fields.includes("program") && !errors.program && !errors.college) {
    const message = programError(values);
    if (message) errors.program = message;
  }
  if (fields.includes("position") && !errors.position && !errors.division) {
    const open: Record<string, string> = divisions[values.division as DivisionId].positions;
    if (!(values.position in open)) errors.position = "Pick a position from this division.";
    else if (slots && (slots[values.position] ?? 0) < 1) errors.position = "This position has no open slots. Pick another.";
  }
  if (fields.includes("portfolioUrl") && !errors.portfolioUrl && needsPortfolio(values.division) && !values.portfolioUrl.trim()) {
    errors.portfolioUrl = "Paste the Google Drive link to your portfolio.";
  }
  return errors;
}

/** Reads the form's values into the shape the schema expects. */
export function readApplication(formData: FormData) {
  const text = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return {
    lastName: text("lastName"),
    firstName: text("firstName"),
    middleInitial: text("middleInitial"),
    studentNumber: text("studentNumber"),
    contactNumber: text("contactNumber"),
    email: text("email"),
    college: text("college"),
    program: text("program"),
    yearLevel: text("yearLevel"),
    facebookUrl: text("facebookUrl"),
    preferredBody: text("preferredBody"),
    division: text("division"),
    position: text("position"),
    cvUrl: text("cvUrl"),
    endorsementUrl: text("endorsementUrl"),
    portfolioUrl: text("portfolioUrl"),
    consent: formData.get("consent") === "on",
  };
}
