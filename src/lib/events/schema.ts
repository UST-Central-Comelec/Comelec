import { z } from "zod";
import { containsEmoji, personNamePattern } from "@/lib/forms/input";
import { colleges, programsByCollege, programLocked, isYearLevelFor, type College } from "@/lib/applications/options";
import { affiliationChoices, attendingChoices, isUstAffiliation, requestKinds, sexChoices, type AffiliationChoice, type RequestKind, type Requests, type SexChoice } from "./options";

// The event registration form's rules, shared by the form (checks each step before moving on) and the
// server action (checks everything again before saving). Five steps:
//   1 Consent; 2 Personal information; 3 University affiliation; 4 Organization; 5 Logistics.
// What step 3 asks depends on the affiliation picked, step 4's details only follow "Official
// Organization Representative", and step 5's extra fields only follow the requests that need them.

const upperName = (message: string) => z.string().trim().min(1, message).max(80, "Keep it under 80 characters.").regex(personNamePattern, "Use letters and spaces only.");
const short = (message: string, max = 120) => z.string().trim().min(1, message).max(max, `Keep it under ${max} characters.`);

const fields = {
  consent: z.literal(true, "You need to agree before we can take your registration."),
  lastName: upperName("Add your last name."),
  firstName: upperName("Add your first name."),
  middleName: upperName("Add your middle name."),
  sex: z.enum(Object.keys(sexChoices) as [SexChoice, ...SexChoice[]], "Pick one."),
  age: z.string().trim().regex(/^\d{1,3}$/, "Use your age in years.").refine((value) => Number(value) >= 10 && Number(value) <= 120, "Use your age in years."),
  email: z.string().trim().toLowerCase().max(120).email("Use a valid email address."),
  affiliation: z.enum(Object.keys(affiliationChoices) as [AffiliationChoice, ...AffiliationChoice[]], "Pick one."),
  attendingAs: z.enum(Object.keys(attendingChoices) as [keyof typeof attendingChoices, ...(keyof typeof attendingChoices)[]], "Pick one."),
};

export type RegistrationValues = ReturnType<typeof readRegistration>;

/** Which step each field is on, to send someone back to the first thing to fix. */
export const stepOf: Record<string, number> = {
  consent: 0,
  lastName: 1, firstName: 1, middleName: 1, sex: 1, age: 1, email: 1,
  affiliation: 2, studentNumber: 2, college: 2, program: 2, yearLevel: 2, office: 2, institution: 2, verification: 2,
  attendingAs: 3, organizationName: 3, organizationCommittee: 3, organizationPosition: 3,
  parkingPlate: 4, parkingModel: 4, parkingColor: 4, parkingArrival: 4, dietaryAllergens: 4,
};

/** A form nobody has filled in yet. */
export const emptyRegistration = (): RegistrationValues => ({
  studentNumber: "", consent: false, lastName: "", firstName: "", middleName: "", sex: "", age: "", email: "", affiliation: "", college: "", program: "", yearLevel: "", office: "", institution: "",
  attendingAs: "", organizationName: "", organizationCommittee: "", organizationPosition: "", requests: [], parkingPlate: "", parkingModel: "", parkingColor: "", parkingArrival: "", dietaryAllergens: "",
});

/** Reads the form's values into the shape the rules expect. */
export function readRegistration(formData: FormData) {
  const text = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return {
    consent: formData.get("consent") === "on",
    lastName: text("lastName"),
    firstName: text("firstName"),
    middleName: text("middleName"),
    sex: text("sex"),
    age: text("age"),
    email: text("email"),
    affiliation: text("affiliation"),
    studentNumber: text("studentNumber"),
    college: text("college"),
    program: text("program"),
    yearLevel: text("yearLevel"),
    office: text("office"),
    institution: text("institution"),
    attendingAs: text("attendingAs"),
    organizationName: text("organizationName"),
    organizationCommittee: text("organizationCommittee"),
    organizationPosition: text("organizationPosition"),
    requests: (Object.keys(requestKinds) as RequestKind[]).filter((kind) => formData.get(`request-${kind}`) === "on"),
    parkingPlate: text("parkingPlate"),
    parkingModel: text("parkingModel"),
    parkingColor: text("parkingColor"),
    parkingArrival: text("parkingArrival"),
    dietaryAllergens: text("dietaryAllergens"),
  };
}

/** What the form knows about the event and the visitor, for the checks that depend on them. */
export type RegistrationContext = {
  /** The affiliations the event is open to. */
  allowed: readonly AffiliationChoice[];
  /** Whoever picks a UST affiliation must verify with UST Google first. */
  requireGoogle: boolean;
  /** The UST email they verified, if they have. */
  verifiedEmail: string | null;
};

/** Whether this registration has to be verified through UST Google, by what it says. */
export const needsVerification = (values: Pick<RegistrationValues, "affiliation">, context: Pick<RegistrationContext, "requireGoogle">) => context.requireGoogle && isUstAffiliation(values.affiliation);

/** A message per invalid field on `step` (or every step), empty when all is well. */
export function checkRegistration(values: RegistrationValues, context: RegistrationContext, step?: number) {
  const errors: Record<string, string> = {};
  const add = (field: string, message: string) => {
    if (step === undefined || stepOf[field] === step) errors[field] ??= message;
  };
  for (const [field, value] of Object.entries(values)) {
    if (typeof value === "string" && containsEmoji(value)) add(field, "Emoji aren’t allowed in this field.");
  }
  const check = (field: keyof typeof fields, value: unknown) => {
    const result = fields[field].safeParse(value);
    if (!result.success) add(field, result.error.issues[0].message);
  };
  const need = (field: keyof RegistrationValues, message: string, max?: number) => {
    const result = short(message, max).safeParse(values[field]);
    if (!result.success) add(field, result.error.issues[0].message);
  };

  // 1. Consent
  check("consent", values.consent);

  // 2. Personal information. A verified UST email is the one kept, whatever was typed.
  check("lastName", values.lastName);
  check("firstName", values.firstName);
  check("middleName", values.middleName);
  check("sex", values.sex);
  check("age", values.age);
  // At an event that verifies UST students and staff, the email can wait for the affiliation (the next
  // step): a UST account is filled in by verifying, and anyone else is sent back to add theirs.
  const waitsForAffiliation = step === 1 && !values.email.trim() && context.requireGoogle && context.allowed.some(isUstAffiliation);
  if (!waitsForAffiliation && !(needsVerification(values, context) && context.verifiedEmail)) {
    check("email", values.email);
    if (isUstAffiliation(values.affiliation) && !errors.email && !values.email.trim().toLowerCase().endsWith("@ust.edu.ph")) add("email", "Use your @ust.edu.ph email.");
  }

  // 3. University affiliation
  check("affiliation", values.affiliation);
  if (values.affiliation && !context.allowed.includes(values.affiliation as AffiliationChoice)) add("affiliation", "This event isn’t open to that. Pick another, or check who it’s open to.");
  if (needsVerification(values, context) && !context.verifiedEmail) add("verification", "Verify your UST Google account to continue.");
  if (values.affiliation === "ust-student") {
    if (values.studentNumber.trim() && !/^\d{10}$/.test(values.studentNumber.trim())) add("studentNumber", "Use your 10-digit student number, or leave it blank.");
    if (!isYearLevelFor(values.college, values.yearLevel)) add("yearLevel", "Pick your year level from the list.");
    if (!(colleges as readonly string[]).includes(values.college)) add("college", "Pick your college or faculty from the list.");
    else if (programLocked(values.college) ? Boolean(values.program) : !(programsByCollege[values.college as College] as readonly string[]).includes(values.program)) add("program", "Pick your program from the list.");
  }
  if (values.affiliation === "ust-staff") need("office", "Add your college, faculty or office.");
  if (values.affiliation === "other-institution") need("institution", "Add your university or institution.", 160);
  if (values.affiliation === "independent" && values.institution.length > 160) add("institution", "Keep it under 160 characters.");

  // 4. Organization
  check("attendingAs", values.attendingAs);
  if (values.attendingAs === "representative") {
    need("organizationName", "Add your organization’s name.", 160);
    need("organizationPosition", "Add your position.");
    if (values.organizationCommittee.length > 120) add("organizationCommittee", "Keep it under 120 characters.");
  }

  // 5. Logistics
  if (values.requests.includes("parking")) {
    need("parkingPlate", "Add the plate number.", 20);
    need("parkingModel", "Add the car’s model.", 60);
    need("parkingColor", "Add the car’s color.", 40);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.parkingArrival)) add("parkingArrival", "Add when you expect to arrive.");
  }
  if (values.requests.includes("dietary")) need("dietaryAllergens", "Say what you can’t eat.", 300);

  return errors;
}

/** The requests as saved: each pending until the unit answers, with what the registrant wrote. */
export function toRequests(values: RegistrationValues): Requests {
  const requests: Requests = {};
  for (const kind of values.requests) {
    if (kind === "parking") requests.parking = { status: "pending", plate: values.parkingPlate.trim().toUpperCase(), model: values.parkingModel.trim(), color: values.parkingColor.trim(), arrival: values.parkingArrival };
    else if (kind === "dietary") requests.dietary = { status: "pending", allergens: values.dietaryAllergens.trim() };
    else requests[kind] = { status: "pending" };
  }
  return requests;
}
