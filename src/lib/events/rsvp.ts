import { z } from "zod";
import { colleges } from "@/lib/applications/options";
import { acknowledgementOf, defaultAcknowledgementStep, defaultPrivacyStep, editorDefinitionSchema, identityAnswer, isBlock, privacyConsent, respondentEmail, type EditorDefinition, type EditorField, type EditorStep, type FormAnswers } from "./form-editor";
import { resolveFlow } from "./form-flow";
import { requestKinds, type RequestKind } from "./options";

export const rsvpFormPath = (eventId: string) => `/events/${eventId}/rsvp-form`;

export const affiliationKinds = {
  "organization-college": "Organization — College-based",
  "organization-university": "Organization — University-wide",
  "council-central": "Council — Central Student Council",
  "council-local": "Council — Local",
  "commission-central": "Commission — Central Comelec",
  "commission-local": "Commission — Local Comelec",
  admin: "Admin",
  "ust-other": "Other UST Affiliation",
  "external-representative": "Organization / Institution Representative",
  "invited-guest": "Invited Guest (Delegates)",
  "resource-person": "Resource Person (Speakers, Facilitators, Panelists)",
} as const;
export type RsvpAffiliation = keyof typeof affiliationKinds;
export const eventRoles = { head: "President, Chairperson, Organization Head", representative: "Officer, Official Representative" } as const;
export const attendanceChoices = {
  confirmed: "Confirmed Attendance",
  proxy: "Sending a Proxy",
  unable: "Unable to Attend",
} as const;
export const attendanceNotes = {
  confirmed: "I confirm that I will attend in person for the entire duration of the event.",
  proxy: "I am unable to attend and will designate a representative.",
  unable: "I am unable to attend the event.",
};
export const delegationChoices = { yes: "Yes", no: "No", pending: "To be confirmed" } as const;
export const ustKinds: RsvpAffiliation[] = ["organization-college", "organization-university", "council-central", "council-local", "commission-central", "commission-local", "admin", "ust-other"];
export const needsLogistics = (kind: string) => ["external-representative", "invited-guest", "resource-person"].includes(kind);
export const emptyLogisticalNeeds = () => ({ requests: [] as RequestKind[], parkingPlate: "", parkingModel: "", parkingColor: "", parkingArrival: "", dietaryAllergens: "" });
export const needsRole = (kind: string) => kind !== "invited-guest" && kind !== "resource-person";
export const needsOrganization = (kind: string) => ["organization-college", "organization-university", "ust-other", "external-representative"].includes(kind);
export const needsCollege = (kind: string) => kind === "council-local" || kind === "commission-local";
export const isUstEmail = (email: string) => email.trim().toLowerCase().endsWith("@ust.edu.ph");
export const committeeAssignments = [
  { id: "programs", label: "Programs & Module Training", phase: "Pre-Event & During", description: "Co-facilitates module discussions on BSKE functions, anti-vote buying, voter rights, and youth civic participation; prepares interactive Q&A/open forum mechanics." },
  { id: "logistics", label: "Logistics, Venue Setup & Technical Operations", phase: "Pre-Event & During", description: "Physical ingress/egress, room styling, sound system, audio-visual equipment management, stage arrangement, and directional signages." },
  { id: "food", label: "Food & Refreshment Logistics", phase: "Pre-Event & During", description: "Coordinates meal packs/snacks distribution for guest delegations and working committees, and ensures water refilling stations." },
  { id: "hospitality", label: "Community Ushering / Hospitality", phase: "During", description: "Guides visiting community partners and manages registration booths, pathfinding, seat allocation, and crowd flow." },
  { id: "safety", label: "Safety, Health & Marshaling", phase: "During", description: "First-aid readiness, crowd discipline, coordination with campus security (OSG/SWDC), and contingency emergency response." },
  { id: "coverage", label: "Coverage, Media & Documentation", phase: "During & Post-Event", description: "Photo and video coverage of sessions, live social media updates, press release preparation, and archiving of event materials." },
  { id: "evaluation", label: "Post-Event Evaluation & Community Relations", phase: "Post-Event", description: "Synthesizes participant feedback forms, drafts liquidation and terminal reports, and manages formal thank-you letters to community partner barangays." },
  { id: "secretariat", label: "Secretariat, Registration & Attendance Control", phase: "All Phases", description: "Prepares master lists, distributes attendee kits/badges, monitors live headcounts, and issues certificates of attendance/participation." },
] as const;
export const logisticalResources = [
  { id: "documentation", label: "Documentation Equipment", description: "DSLR/mirrorless cameras, video cameras, tripods, or stabilizers" },
  { id: "communication", label: "Communication Equipment", description: "two-way radios/walkie-talkies and accessories" },
  { id: "audio", label: "Audio Equipment", description: "microphones, speakers, mixers, or portable PA systems" },
  { id: "presentation", label: "Presentation Equipment", description: "laptops, projectors, screens, or presentation clickers" },
  { id: "power", label: "Power Accessories", description: "extension cords, power strips, power banks, or charging stations" },
  { id: "signage", label: "Signage and Display Materials", description: "standees, directional signage stands, easels, or bulletin boards" },
  { id: "none", label: "None / Not applicable", description: "" },
  { id: "other", label: "Other", description: "" },
] as const;
export type CommitteeAssignment = typeof committeeAssignments[number]["id"];
export type LogisticalResource = typeof logisticalResources[number]["id"];
export const committeeLimitSchema = z.coerce.number().int().min(1).max(committeeAssignments.length);

/* The RSVP's answers. Since its questions became editable, a response keeps every answer by question
   (`values`) with the form as it was answered (`definition`). Older responses kept fixed answers. */
type LegacyProfile = { lastName: string; firstName: string; middleName: string; email: string; studentNumber: string };
export type LegacyRsvpAnswers = {
  profile: LegacyProfile; affiliation: "ust" | "external"; affiliationKind: RsvpAffiliation; organization: string; college: string; school: string;
  role: "" | keyof typeof eventRoles; attendance: keyof typeof attendanceChoices; proxy?: LegacyProfile; delegation: keyof typeof delegationChoices; additionalParticipants: string;
  committees?: CommitteeAssignment[]; resources?: LogisticalResource[]; resourceOther?: string; logisticalNeeds?: ReturnType<typeof emptyLogisticalNeeds>;
  customAnswers?: Record<string, string | string[]>; customDefinition?: { steps: Array<{ fields: Array<{ id: string; label: string; kind: string }> }> }; accurate: boolean; authorized: boolean;
};
export type RsvpAnswers = { version: 2; values: FormAnswers; definition: EditorDefinition };
export type RsvpResponse = { id: string; answers: LegacyRsvpAnswers | RsvpAnswers; created_at: string };
export type RsvpSettings = { require_google?: boolean; enabled: boolean; invitation_token: string; committee_limit: number; definition?: EditorDefinition | null };
export const isLegacyRsvp = (answers: RsvpResponse["answers"]): answers is LegacyRsvpAnswers => "profile" in answers;
const legacyName = (answers: LegacyRsvpAnswers) => [answers.profile.firstName, answers.profile.middleName, answers.profile.lastName].filter(Boolean).join(" ");

/** Who answered: what the participant list and receipts need, from either kind of response. */
export function rsvpRespondent(answers: RsvpResponse["answers"]) {
  if (isLegacyRsvp(answers)) return { ...answers.profile, name: legacyName(answers), affiliation: affiliationKinds[answers.affiliationKind], organization: answers.organization || answers.college };
  const { definition, values } = answers;
  const part = (identity: Parameters<typeof identityAnswer>[2]) => identityAnswer(definition, values, identity);
  const [firstName, middleName, lastName] = [part("firstName"), part("middleName"), part("lastName")];
  const email = respondentEmail(definition, values);
  return { firstName, middleName, lastName, email, studentNumber: part("studentNumber"), name: [firstName, middleName, lastName].filter(Boolean).join(" ") || email, affiliation: part("affiliation"), organization: part("organization") };
}

/** A response as label and answer pairs, for the RSVP inbox and the participant review. */
export function rsvpResponseFacts(answers: RsvpResponse["answers"]): Array<[string, string]> {
  if (isLegacyRsvp(answers)) return legacyFacts(answers);
  return formFacts(answers.definition, answers.values);
}
/** Every question answered, in form order; ranked ticks keep their numbers. */
export function formFacts(definition: EditorDefinition, values: FormAnswers): Array<[string, string]> {
  return definition.steps.flatMap(step => step.fields).flatMap((field): Array<[string, string]> => {
    const value = values[field.id];
    if (isBlock(field.kind) || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return [];
    if (field.kind === "confirm") return [[field.label, value === "yes" ? "Confirmed" : "Not confirmed"]];
    return [[field.label, Array.isArray(value) ? value.map((item, index) => field.ranked ? `${index + 1}. ${item}` : item).join("\n") : value]];
  });
}

/** An RSVP saved before its questions became editable: its answers sit in fixed places. */
function legacyFacts(answers: LegacyRsvpAnswers): Array<[string, string]> {
  const rows: Array<[string, string]> = [["Name", legacyName(answers)], ["Email", answers.profile.email], ["Student number", answers.profile.studentNumber], ["Affiliation", answers.affiliation === "ust" ? "University of Santo Tomas" : "External"], ["Affiliation type", affiliationKinds[answers.affiliationKind]], ["Organization / affiliation", answers.organization], ["College / faculty", answers.college], ["School / university", answers.school], ["Attending as", answers.role ? eventRoles[answers.role] : affiliationKinds[answers.affiliationKind]], ["Attendance", attendanceChoices[answers.attendance]], ["Additional participants", delegationChoices[answers.delegation]], ["Additional participant count / range", answers.additionalParticipants], ["Committee preferences", (answers.committees ?? []).map((id, index) => `${index + 1}. ${committeeAssignments.find(item => item.id === id)?.label ?? id}`).join("\n")], ["Logistical support and resources", (answers.resources ?? []).map(id => logisticalResources.find(item => item.id === id)?.label ?? id).join("\n")], ["Other resources", answers.resourceOther ?? ""], ["Information confirmed accurate", answers.accurate ? "Yes" : "No"], ["Authorized to coordinate", answers.authorized ? "Yes" : "No"]];
  if (needsLogistics(answers.affiliationKind)) {
    for (let index = rows.length - 1; index >= 0; index--) if (["Committee preferences", "Logistical support and resources", "Other resources"].includes(rows[index][0])) rows.splice(index, 1);
    const needs = answers.logisticalNeeds ?? emptyLogisticalNeeds();
    rows.push(["Logistical needs", needs.requests.map(kind => requestKinds[kind].short).join("\n") || "None requested"], ["Car plate number", needs.parkingPlate], ["Car model", needs.parkingModel], ["Car color", needs.parkingColor], ["Expected time of arrival", needs.parkingArrival], ["Allergens", needs.dietaryAllergens]);
  }
  if (answers.proxy) rows.push(["Proxy name", [answers.proxy.firstName, answers.proxy.middleName, answers.proxy.lastName].filter(Boolean).join(" ")], ["Proxy email", answers.proxy.email], ["Proxy student number", answers.proxy.studentNumber]);
  for (const field of answers.customDefinition?.steps.flatMap(step => step.fields) ?? []) { const value = answers.customAnswers?.[field.id]; if (field.kind !== "content" && value) rows.push([field.label, Array.isArray(value) ? value.join(", ") : value]); }
  return rows.filter(([, value]) => Boolean(value));
}

/*
 * The RSVP form as it starts: ordinary questions, every one of them editable. Conditional choices
 * carry the old rules: a UST email asks for a student number; the affiliation leads to its own
 * details; Invited Guests and Resource Persons skip "Attending as"; a proxy gets a profile of their
 * own; UST units see committees and resources, external respondents the logistical needs.
 */
const text = (id: string, label: string, extra: Partial<EditorField> = {}): EditorField => ({ id, label, prompt: "", kind: "text", required: true, options: [], ...extra });
const name = (id: string, label: string, identity?: EditorField["identity"]) => text(id, label, { rules: { uppercase: true, letters: true }, ...(identity ? { identity } : {}) });
const choice = (id: string, kind: "radio" | "dropdown" | "checkbox", label: string, options: string[], extra: Partial<EditorField> = {}): EditorField => ({ id, label, prompt: "", kind, required: true, options, ...extra });
const ustTypes = ["Organization — College-based", "Organization — University-wide", "Council — Central Student Council", "Council — Local", "Commission — Central Comelec", "Commission — Local Comelec", "Admin", "Other UST Affiliation"];
const externalTypes = ["Organization / Institution Representative", "Invited Guest (Delegates)", "Resource Person (Speakers, Facilitators, Panelists)"];
const step = (id: string, title: string, fields: EditorField[], description = ""): EditorStep => ({ id, title, description, fields });

export const rsvpAcknowledgement = { title: "Your RSVP has been recorded.", message: "Share the public registration link with your additional participants. Each participant must register individually.", link: true, email: true, subject: "RSVP received — {event}", body: "Hi {name},\n\nYour collaborator RSVP for {event} has been recorded.\n\nShare this public registration link with your additional participants. Each participant must register individually. Your RSVP doesn’t register them.\n{link}" };

export const defaultRsvpDefinition: EditorDefinition = { steps: [
  defaultPrivacyStep([privacyConsent("rsvp_consent", "event’s coordination"), { id: "rsvp_consent_share", kind: "confirm", required: true, options: [], prompt: "", label: "I understand that my RSVP details are shared with the event’s organizers and its collaborating units." }]),
  step("rsvp_profile", "Profile", [
    name("rsvp_last_name", "Last name", "lastName"), name("rsvp_first_name", "First name", "firstName"), name("rsvp_middle_name", "Middle name", "middleName"),
    { id: "rsvp_email", label: "Email", prompt: "", kind: "email", required: true, options: [], identity: "email", branches: [["rsvp_student_number"], []] },
    text("rsvp_student_number", "Student number", { rules: { studentNumber: true }, identity: "studentNumber" }),
  ]),
  step("rsvp_affiliation", "Affiliation", [
    choice("rsvp_affiliation", "radio", "Affiliation", ["University of Santo Tomas", "External"], { identity: "affiliation", branches: [["rsvp_ust_type", "rsvp_committees", "rsvp_resources"], ["rsvp_external_type", "rsvp_logistics"]] }),
    choice("rsvp_ust_type", "dropdown", "UST affiliation", ustTypes, { branches: [["rsvp_org_name", "rsvp_role"], ["rsvp_org_name", "rsvp_role"], ["rsvp_role"], ["rsvp_college", "rsvp_role"], ["rsvp_role"], ["rsvp_college", "rsvp_role"], ["rsvp_role"], ["rsvp_other_affiliation", "rsvp_role"]] }),
    text("rsvp_org_name", "Organization name", { identity: "organization" }),
    choice("rsvp_college", "dropdown", "College / Faculty", [...colleges]),
    text("rsvp_other_affiliation", "Specify your affiliation"),
    choice("rsvp_external_type", "radio", "External affiliation", externalTypes, { branches: [["rsvp_external_org", "rsvp_external_school", "rsvp_role"], [], []] }),
    text("rsvp_external_org", "Organization / Affiliation"),
    text("rsvp_external_school", "School / University", { required: false }),
  ]),
  step("rsvp_role", "Attending as", [choice("rsvp_role", "radio", "Attending as", Object.values(eventRoles))]),
  step("rsvp_attendance", "Attendance Confirmation", [
    choice("rsvp_attendance", "radio", "Attendance response", Object.values(attendanceChoices), { notes: Object.values(attendanceNotes), branches: [[], ["rsvp_proxy_last_name", "rsvp_proxy_first_name", "rsvp_proxy_middle_name", "rsvp_proxy_email"], []] }),
    name("rsvp_proxy_last_name", "Proxy’s last name"), name("rsvp_proxy_first_name", "Proxy’s first name"), name("rsvp_proxy_middle_name", "Proxy’s middle name"),
    { id: "rsvp_proxy_email", label: "Proxy’s email", prompt: "", kind: "email", required: true, options: [], branches: [["rsvp_proxy_student_number"], []] },
    text("rsvp_proxy_student_number", "Proxy’s student number", { rules: { studentNumber: true } }),
  ], "Select your attendance response."),
  step("rsvp_delegation", "Organization Delegation", [
    choice("rsvp_delegation", "radio", "Will you or your organization send additional participants?", Object.values(delegationChoices), { branches: [["rsvp_additional"], [], ["rsvp_additional"]] }),
    text("rsvp_additional", "Number of Additional Participants (can be a range)", { prompt: "Count only additional participants. Exclude yourself or the proxy attending in your place.", rules: { hyphenOnly: true } }),
  ]),
  step("rsvp_committees", "Preferred committee assignments", [
    choice("rsvp_committees", "checkbox", "Preferred committee assignments", committeeAssignments.map(item => `${item.label} (${item.phase})`), { required: false, notes: committeeAssignments.map(item => item.description), min: 1, max: 2, ranked: true }),
  ], "Select your unit’s preferred committee assignments. Responsibilities are categorized by operational phase to ensure end-to-end event success."),
  step("rsvp_resources_step", "Logistical Support and Resources", [
    choice("rsvp_resources", "checkbox", "Logistical Support and Resources", logisticalResources.map(item => item.label), { required: false, prompt: "Which equipment, supplies, or materials can your unit lend or provide for the event? Select all that apply.", notes: logisticalResources.map(item => item.description), min: 1, max: logisticalResources.length, branches: logisticalResources.map(item => item.id === "other" ? ["rsvp_resource_other"] : []) }),
    text("rsvp_resource_other", "Other resources", { prompt: "Type the equipment, supplies, or materials." }),
  ]),
  step("rsvp_logistics", "Logistical Needs", [
    choice("rsvp_logistics", "checkbox", "Logistical needs", Object.values(requestKinds).map(item => item.label), { required: false, min: 1, max: Object.keys(requestKinds).length, branches: Object.keys(requestKinds).map(kind => kind === "parking" ? ["rsvp_car_plate", "rsvp_car_model", "rsvp_car_color", "rsvp_arrival"] : kind === "dietary" ? ["rsvp_allergens"] : []) }),
    text("rsvp_car_plate", "Car plate number", { rules: { uppercase: true, hyphenOnly: true } }), text("rsvp_car_model", "Car model"), text("rsvp_car_color", "Car color"),
    text("rsvp_arrival", "Expected time of arrival", { prompt: "For example, 8:30 AM" }),
    text("rsvp_allergens", "Allergens", { prompt: "For example: peanuts, shellfish; vegetarian" }),
  ], "Select the logistical assistance you need for the event. Requests are optional and subject to availability."),
  step("rsvp_conforme", "Conforme", [
    { id: "rsvp_accurate", kind: "confirm", required: true, options: [], prompt: "", label: "I confirm that the information provided is accurate and will notify the event organizers of any changes to my attendance or representation." },
    { id: "rsvp_authorized", kind: "confirm", required: true, options: [], prompt: "", label: "I confirm that I am authorized to coordinate participants on behalf of my organization." },
  ]),
  defaultAcknowledgementStep(rsvpAcknowledgement),
] };

/**
 * Forms saved before every question became editable (locked `builtin` steps, or `standard` questions
 * answered in fixed places) open as the editable default; questions someone added are kept, in a
 * step of their own before the Conforme.
 */
export function normalizeRsvpDefinition(definition: EditorDefinition | null | undefined): EditorDefinition {
  if (!definition) return defaultRsvpDefinition;
  const legacy = definition.steps.some(item => item.builtin !== undefined) || definition.steps.some(item => item.fields.some(field => "standard" in field)) || definition.steps[0]?.kind !== "privacy";
  if (!legacy) {
    const needsUpdate = definition.steps.some(item => item.fields.some(field => field.id.startsWith("rsvp_") && field.rules?.noSpecial) || (item.fields.some(field => field.id === "rsvp_committees") && item.fields.some(field => field.id === "rsvp_resources")));
    if (!needsUpdate) return definition;
    const ids = new Set(definition.steps.map(item => item.id));
    return { ...definition, steps: definition.steps.flatMap(item => {
      const fields = item.fields.map(field => {
        if (!field.id.startsWith("rsvp_") || !field.rules?.noSpecial) return field;
        const rules = { ...field.rules, hyphenOnly: true };
        delete rules.noSpecial;
        return { ...field, rules };
      });
      if (!fields.some(field => field.id === "rsvp_committees") || !fields.some(field => field.id === "rsvp_resources")) return [{ ...item, fields }];
      const resourceIds = new Set(["rsvp_resources", "rsvp_resource_other"]);
      let resourceStepId = "rsvp_resources_step";
      while (ids.has(resourceStepId)) resourceStepId += "_";
      ids.add(resourceStepId);
      return [{ ...item, title: item.title === "Committee Involvement & Functional Roles" ? "Preferred committee assignments" : item.title, fields: fields.filter(field => !resourceIds.has(field.id)) }, step(resourceStepId, "Logistical Support and Resources", fields.filter(field => resourceIds.has(field.id)))];
    }) };
  }
  const added = definition.steps.flatMap(item => item.fields).filter(field => !("standard" in field) && field.id.startsWith("q_")).map(field => { const copy = { ...field }; delete copy.branches; return copy; });
  if (!added.length) return defaultRsvpDefinition;
  const steps = [...defaultRsvpDefinition.steps];
  steps.splice(steps.length - 2, 0, step("rsvp_more", "More questions", added));
  return { steps };
}
export const rsvpDefinitionSchema = editorDefinitionSchema;
export { acknowledgementOf, resolveFlow };
