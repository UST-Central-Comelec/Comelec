import { z } from "zod";
import { containsEmoji, personNamePattern } from "@/lib/forms/input";
import { comelecUnit } from "@/lib/events/options";
import { isBodyOpen, type OpenBodies } from "@/lib/periods/summary";
import { colleges, conflicts, positionsForUnit, preferredBodies, programsByCollege, yearLevels, programLocked, isYearLevelFor, type College, type ConflictId, type DeclaredConflict, type SlotCounts } from "./options";

// Shared by the form (checks each step before moving on) and the server action (checks
// everything again before saving).

const keys = <T extends object>(record: T) => Object.keys(record) as [keyof T & string, ...(keyof T & string)[]];
const driveLink = (message: string) => z.string().trim().max(500).regex(/^https:\/\/(drive|docs)\.google\.com\/\S+$/, message);
const confirmed = z.literal(true, "This qualification is required to apply.");
const conflictAnswer = z.enum(["no", "yes"], "Answer yes or no.");
const conflictDetail = z.string().trim().max(200, "Keep it under 200 characters.");
const name = (message: string) => z.string().trim().min(1, message).max(80).regex(personNamePattern, "Use letters and spaces only.");

/** Field rules, one per input. `.pick()` checks a single step's fields. */
export const applicationFields = z.object({
  lastName: name("Add your last name."),
  firstName: name("Add your first name."),
  middleName: name("Add your middle name."),
  studentNumber: z.string().trim().regex(/^\d{10}$/, "Use your 10-digit student number."),
  // Optional: empty, or a Philippine mobile number.
  contactNumber: z.union([z.literal(""), z.string().trim().regex(/^09\d{2}-?\d{3}-?\d{4}$/, "Use an 11-digit mobile number starting with 09, like 0917-123-4567.")]),
  email: z.string().trim().toLowerCase().email("Use a valid email address.").max(120).refine((value) => value.endsWith("@ust.edu.ph"), "Use your @ust.edu.ph email."),
  college: z.enum(colleges as [College, ...College[]], "Pick your college or faculty from the list."),
  program: z.string().trim(),
  yearLevel: z.enum(keys(yearLevels), "Pick your year level."),
  facebookUrl: z.string().trim().max(300).regex(/^(https?:\/\/)?(www\.|m\.|web\.)?(facebook|fb)\.com\/\S+$/i, "Use your Facebook profile link, like facebook.com/yourname."),
  preferredBody: z.enum(keys(preferredBodies), "Pick where you’d like to serve."),
  division: z.string().transform(() => ""),
  position: z.string().min(1, "Pick the position you’re applying for."),
  cvUrl: driveLink("Paste the Google Drive link to your CV or résumé."),
  registrationFormUrl: driveLink("Paste the Google Drive link to your latest registration form."),
  letterOfIntentUrl: driveLink("Paste the Google Drive link to your letter of intent."),
  endorsementUrl: z.union([z.literal(""), driveLink("Use a Google Drive link.")]),
  portfolioUrl: z.union([z.literal(""), driveLink("Use a Google Drive link.")]),
  gradesUrl: z.union([z.literal(""), driveLink("Use a Google Drive link.")]),
  consent: z.literal(true, "You need to agree before we can process your application."),
  meetsUnits: confirmed,
  meetsGwa: confirmed,
  notRecentCandidate: confirmed,
  // A "yes" needs the detail field filled in and the pledge checked, both checked in checkFields.
  conflictOffice: conflictAnswer,
  conflictOfficeDetail: conflictDetail,
  conflictParty: conflictAnswer,
  conflictPartyDetail: conflictDetail,
  conflictPolitics: conflictAnswer,
  conflictPoliticsDetail: conflictDetail,
  conflictPledge: z.boolean(),
  // Checked in checkFields against the slots that are still open.
  interviewSlot: z.string(),
});

export type ApplicationField = keyof typeof applicationFields.shape;
export type ApplicationValues = ReturnType<typeof readApplication>;

/** Each conflict question's yes/no field and the field that names the office or group. */
export const conflictFields = {
  office: ["conflictOffice", "conflictOfficeDetail"],
  party: ["conflictParty", "conflictPartyDetail"],
  politics: ["conflictPolitics", "conflictPoliticsDetail"],
} as const satisfies Record<ConflictId, readonly [ApplicationField, ApplicationField]>;

/** The conflicts answered "yes", with what the applicant named. */
export function declaredConflicts(values: ApplicationValues): DeclaredConflict[] {
  return (Object.keys(conflicts) as ConflictId[])
    .filter((type) => values[conflictFields[type][0]] === "yes")
    .map((type) => ({ type, detail: values[conflictFields[type][1]].trim() }));
}

/** The program has to be one the chosen college offers. */
export function programError(values: Pick<ApplicationValues, "college" | "program">) {
  const programs: readonly string[] = programsByCollege[values.college as College] ?? [];
  if (programLocked(values.college)) return values.program ? "This school has no program to select." : null;
  return !values.program || !programs.includes(values.program) ? "Pick a program from your college’s list." : null;
}

/**
 * Why an application can't go to the unit picked. Every unit recruits on its own: the Central
 * Comelec, and each college's Local Comelec unit, which takes applicants from its own college.
 */
export function closedBodyError(preferredBody: string, college: string) {
  if (preferredBody !== "local") return "The Central Comelec isn’t taking applications right now.";
  return college ? `The ${comelecUnit("local", college)} isn’t taking applications right now.` : "Your college’s Local Comelec isn’t taking applications right now.";
}

export function needsPortfolio(position: string) {
  return /public-information|creatives/.test(position);
}

/**
 * Checks the given fields and returns a message per invalid field (empty when all are valid).
 * `openInterviews` is the ids of interview slots with room; when there are none, the interview is skipped.
 * `bodies` is the units recruiting right now; the one the applicant asks to serve in has to be among them.
 */
export function checkFields(values: ApplicationValues, fields: ApplicationField[], slots?: SlotCounts, openInterviews?: readonly string[], bodies?: OpenBodies) {
  const mask = Object.fromEntries(fields.map((field) => [field, true])) as Partial<Record<ApplicationField, true>>;
  const result = applicationFields.pick(mask).safeParse(values);
  const errors: Record<string, string> = {};
  if (!result.success) for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message;
  for (const field of fields) {
    const value = values[field];
    if (typeof value === "string" && containsEmoji(value)) errors[field] = "Emoji aren’t allowed in this field.";
  }
  if (fields.includes("program") && !errors.program && !errors.college) {
    const message = programError(values);
    if (message) errors.program = message;
  }
  if (fields.includes("yearLevel") && !isYearLevelFor(values.college, values.yearLevel)) errors.yearLevel = "Pick a year or grade level from your school’s list.";
  if (fields.includes("preferredBody") && !errors.preferredBody && bodies && !isBodyOpen(bodies, values.preferredBody, values.college)) {
    errors.preferredBody = closedBodyError(values.preferredBody, values.college);
  }
  if (fields.includes("position") && !errors.position) {
    const positions = positionsForUnit(values.preferredBody === "local" ? values.college : "");
    if (!positions.some((position) => position.id === values.position)) errors.position = "Pick a position available in this Comelec unit.";
    else if (slots && (slots[values.position] ?? 0) < 1) errors.position = "This position has no open slots. Pick another.";
  }
  if (fields.includes("interviewSlot") && openInterviews?.length) {
    if (!values.interviewSlot) errors.interviewSlot = "Pick an interview time.";
    else if (!openInterviews.includes(values.interviewSlot)) errors.interviewSlot = "That time just filled up. Pick another.";
  }
  for (const [answer, detail] of Object.values(conflictFields)) {
    if (fields.includes(detail) && !errors[detail] && values[answer] === "yes" && !values[detail].trim()) errors[detail] = "Please name it so the commission can follow up with you.";
  }
  if (fields.includes("conflictPledge") && declaredConflicts(values).length && !values.conflictPledge) {
    errors.conflictPledge = "Please confirm this commitment to continue.";
  }
  if (fields.includes("portfolioUrl") && !errors.portfolioUrl && needsPortfolio(values.position) && !values.portfolioUrl.trim()) {
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
    middleName: text("middleName"),
    studentNumber: text("studentNumber"),
    contactNumber: text("contactNumber").trim(),
    email: text("email"),
    college: text("college"),
    program: text("program"),
    yearLevel: text("yearLevel"),
    facebookUrl: text("facebookUrl"),
    preferredBody: text("preferredBody"),
    division: text("division"),
    position: text("position"),
    cvUrl: text("cvUrl"),
    registrationFormUrl: text("registrationFormUrl"),
    letterOfIntentUrl: text("letterOfIntentUrl"),
    endorsementUrl: text("endorsementUrl"),
    portfolioUrl: text("portfolioUrl"),
    gradesUrl: text("gradesUrl"),
    consent: formData.get("consent") === "on",
    meetsUnits: formData.get("meetsUnits") === "on",
    meetsGwa: formData.get("meetsGwa") === "on",
    notRecentCandidate: formData.get("notRecentCandidate") === "on",
    conflictOffice: text("conflictOffice"),
    conflictOfficeDetail: text("conflictOfficeDetail"),
    conflictParty: text("conflictParty"),
    conflictPartyDetail: text("conflictPartyDetail"),
    conflictPolitics: text("conflictPolitics"),
    conflictPoliticsDetail: text("conflictPoliticsDetail"),
    conflictPledge: formData.get("conflictPledge") === "on",
    interviewSlot: text("interviewSlot"),
  };
}
