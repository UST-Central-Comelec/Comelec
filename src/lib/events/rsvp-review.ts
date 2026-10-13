import { isPersonNameField } from "@/lib/forms/input";
import { cleanAnswer, keptAnswers, type EditorDefinition, type EditorField, type FormAnswers } from "./form-editor";
import { affiliationKinds, attendanceChoices, committeeAssignments, delegationChoices, eventRoles, isLegacyRsvp, logisticalResources, type RsvpResponse } from "./rsvp";
import { requestKinds, type RequestKind } from "./options";

export const isRsvpReviewStep = (step: EditorDefinition["steps"][number]) => step.kind !== "privacy" && step.kind !== "acknowledgement" && step.id !== "rsvp_conforme" && !/^(data privacy|privacy|conforme|receipt|acknowledgement)$/i.test(step.title.trim());

/** Group the modal's visible sections without changing the submitted form or its branching. */
export function rsvpReviewSteps(steps: EditorDefinition["steps"]) {
  const shown = steps.filter(isRsvpReviewStep);
  const profileIds = new Set(["rsvp_profile", "rsvp_affiliation", "rsvp_role", "rsvp_attendance", "rsvp_delegation", "profile", "affiliation", "attendance"]);
  const profile = shown.filter(step => profileIds.has(step.id));
  return shown.flatMap(step => {
    if (profileIds.has(step.id)) return step === profile[0] ? [{ ...step, title: "Profile & Attendance", fields: profile.flatMap(section => section.fields) }] : [];
    if (step.id === "rsvp_committees" || step.id === "committees") return [{ ...step, title: "Committee Assignment", fields: step.fields.map(field => field.id === "rsvp_committees" || field.id === "committees" ? { ...field, label: "Committee Assignment" } : field) }];
    if (step.id === "rsvp_resources_step" || step.id === "resources" || step.fields.some(field => field.id === "rsvp_resources" || field.id === "resources")) return [{ ...step, title: "Logistical Support", fields: step.fields.map(field => field.id === "rsvp_resources" || field.id === "resources" ? { ...field, label: "Logistical Support" } : field) }];
    return [step];
  });
}

/** Match the registrant viewer's numbered detail groups inside the combined RSVP tab. */
export function rsvpProfileGroups(fields: EditorField[]) {
  const profileIds = new Set(["rsvp_last_name", "rsvp_first_name", "rsvp_middle_name", "rsvp_email", "rsvp_student_number", "rsvp_sex", "rsvp_age"]);
  const affiliationIds = new Set(["rsvp_affiliation", "rsvp_ust_type", "rsvp_org_scope", "rsvp_org_name", "rsvp_council_scope", "rsvp_commission_scope", "rsvp_college", "rsvp_admin_office", "rsvp_other_affiliation", "rsvp_external_type", "rsvp_external_org", "rsvp_external_school", "affiliation", "affiliationKind", "organization", "college", "school"]);
  const groupOf = (field: EditorField) => profileIds.has(field.id) || field.id.startsWith("profile.") ? 0 : affiliationIds.has(field.id) ? 1 : 2;
  return ["Profile", "Affiliation", "Participation"].map((title, index) => ({ title, number: String(index + 1).padStart(2, "0"), fields: fields.filter(field => groupOf(field) === index) })).filter(group => group.fields.length > 0);
}

/** Legacy responses keep their original shape; the editor maps their fields to a review form. */
export function rsvpReviewModel(answers: RsvpResponse["answers"]) {
  if (!isLegacyRsvp(answers)) {
    const proxyNames: Record<string, "firstName" | "middleName" | "lastName"> = { rsvp_proxy_first_name: "firstName", rsvp_proxy_middle_name: "middleName", rsvp_proxy_last_name: "lastName" };
    const definition = { ...answers.definition, steps: answers.definition.steps.map(step => ({ ...step, fields: step.fields.map(field => proxyNames[field.id] || isPersonNameField(field.id) ? { ...field, identity: proxyNames[field.id] ?? (field.id.split(".").at(-1) === "lastName" ? "lastName" : field.id.split(".").at(-1) === "middleName" ? "middleName" : "firstName") as "firstName" | "middleName" | "lastName" } : field) })) };
    return { definition, values: answers.values, paths: [] as Array<{ id: string; options?: Record<string, string> }> };
  }
  const values: FormAnswers = {};
  const paths: Array<{ id: string; options?: Record<string, string> }> = [];
  function field(id: string, label: string, options?: Record<string, string>, required = false): EditorField {
    const value = id.split(".").reduce<unknown>((part, key) => part && typeof part === "object" ? (part as Record<string, unknown>)[key] : undefined, answers);
    const isName = isPersonNameField(id);
    const question: EditorField = { id, label, prompt: "", kind: options ? (Array.isArray(value) || ["committees", "resources", "logisticalNeeds.requests"].includes(id)) ? "checkbox" : "dropdown" : /email$/i.test(id) ? "email" : "text", required, options: options ? Object.values(options) : [], ...(isName ? { identity: id.split(".").at(-1) === "lastName" ? "lastName" : id.split(".").at(-1) === "middleName" ? "middleName" : "firstName", rules: { uppercase: true, letters: true } } : /studentNumber$/.test(id) ? { rules: { studentNumber: true } } : {}) };
    paths.push({ id, options });
    const shown = Array.isArray(value) ? value.map(item => options?.[item] ?? item) : options?.[String(value)] ?? String(value ?? "");
    values[id] = question.kind === "checkbox" ? Array.isArray(shown) ? shown : [] : cleanAnswer(question, String(shown));
    return question;
  }
  const profile = (prefix: string, required = false) => [field(`${prefix}.lastName`, "Last name", undefined, required), field(`${prefix}.firstName`, "First name", undefined, required), field(`${prefix}.middleName`, "Middle name"), field(`${prefix}.email`, "Email", undefined, required), field(`${prefix}.studentNumber`, "Student number")];
  const proxyFields = profile("proxy", true);
  const attendance = field("attendance", "Attendance", attendanceChoices);
  attendance.branches = [[], proxyFields.map(field => field.id), []];
  const definition: EditorDefinition = { steps: [
    { id: "profile", title: "Profile", description: "", fields: profile("profile", true) },
    { id: "affiliation", title: "Affiliation", description: "", fields: [field("affiliation", "Affiliation", { ust: "University of Santo Tomas", external: "External" }), field("affiliationKind", "Affiliation type", affiliationKinds), field("organization", "Organization / affiliation"), field("college", "College / faculty"), field("school", "School / university")] },
    { id: "attendance", title: "Attendance and delegation", description: "", fields: [field("role", "Attending as", { ...eventRoles, witness: "Witness", guardian: "Guardian" }), attendance, field("delegation", "Additional participants", delegationChoices), field("additionalParticipants", "Additional participant count / range"), ...proxyFields] },
    { id: "committees", title: "Preferred committee assignments", description: "", fields: [{ ...field("committees", "Preferred committee assignments", Object.fromEntries(committeeAssignments.map(item => [item.id, item.label]))), ranked: true }] },
    { id: "resources", title: "Logistical support and resources", description: "", fields: [field("resources", "Logistical support and resources", Object.fromEntries(logisticalResources.map(item => [item.id, item.label]))), field("resourceOther", "Other resources")] },
    { id: "logistics", title: "Logistical requests", description: "", fields: [...(answers.logisticalNeeds ? [field("logisticalNeeds.requests", "Logistical needs", Object.fromEntries(Object.entries(requestKinds).map(([id, item]) => [id, item.short]))), field("logisticalNeeds.parkingPlate", "Car plate number"), field("logisticalNeeds.parkingModel", "Car model"), field("logisticalNeeds.parkingColor", "Car color"), field("logisticalNeeds.parkingArrival", "Expected time of arrival"), field("logisticalNeeds.dietaryAllergens", "Allergens")] : [])] },
  ] };
  const custom = answers.customDefinition?.steps.flatMap(step => step.fields).filter(item => item.kind !== "content" && item.kind !== "image") ?? [];
  if (custom.length) definition.steps.push({ id: "additional", title: "Additional information", description: "", fields: custom.map(item => { const question = field(`customAnswers.${item.id}`, item.label, Array.isArray(answers.customAnswers?.[item.id]) ? Object.fromEntries((answers.customAnswers![item.id] as string[]).map(value => [value, value])) : undefined); if (item.kind === "email" || item.kind === "link" || item.kind === "textarea") question.kind = item.kind; return question; }) });
  return { definition, values, paths };
}

/** Applies only review fields. Privacy consent and Conforme remain exactly as submitted. */
export function editedRsvpAnswers(original: RsvpResponse["answers"], incoming: FormAnswers): RsvpResponse["answers"] {
  const model = rsvpReviewModel(original);
  const editableFields = model.definition.steps.filter(isRsvpReviewStep).flatMap(step => step.fields);
  const allowed = new Set(editableFields.map(field => field.id));
  const values = { ...model.values };
  for (const field of editableFields) values[field.id] = incoming[field.id] ?? (field.kind === "checkbox" ? [] : "");
  if (!isLegacyRsvp(original)) {
    const kept = keptAnswers(model.definition, values);
    for (const step of model.definition.steps.filter(step => !isRsvpReviewStep(step))) for (const field of step.fields) if (field.id in original.values) kept[field.id] = original.values[field.id];
    return { ...original, values: kept };
  }
  const normalized = keptAnswers(model.definition, values);
  const fieldKinds = new Map(model.definition.steps.flatMap(step => step.fields.map(field => [field.id, field.kind] as const)));
  const result = structuredClone(original);
  for (const path of model.paths) {
    if (!allowed.has(path.id)) continue;
    const parts = path.id.split(".");
    const parent = parts.slice(0, -1).reduce<Record<string, unknown>>((part, key) => {
      if (!part[key] || typeof part[key] !== "object") part[key] = {};
      return part[key] as Record<string, unknown>;
    }, result as unknown as Record<string, unknown>);
    const reverse = (value: string) => path.options ? Object.entries(path.options).find(([, label]) => label === value)?.[0] ?? value : value;
    const value = normalized[path.id] ?? (fieldKinds.get(path.id) === "checkbox" ? [] : "");
    parent[parts.at(-1)!] = Array.isArray(value) ? value.map(reverse) : reverse(String(value ?? ""));
  }
  if (result.attendance !== "proxy") delete result.proxy;
  return result;
}

/** The same six logistical requests and detail labels used by the registrants viewer. */
export const rsvpLogisticsFieldIds = new Set(["rsvp_logistics", "rsvp_car_plate", "rsvp_car_model", "rsvp_car_color", "rsvp_arrival", "rsvp_allergens", "logisticalNeeds.requests", "logisticalNeeds.parkingPlate", "logisticalNeeds.parkingModel", "logisticalNeeds.parkingColor", "logisticalNeeds.parkingArrival", "logisticalNeeds.dietaryAllergens"]);
export function rsvpLogisticalRequests(values: FormAnswers) {
  const selected = values.rsvp_logistics ?? values["logisticalNeeds.requests"];
  const choices = Array.isArray(selected) ? selected : [];
  const detail = (modern: string, legacy: string) => String(values[modern] ?? values[`logisticalNeeds.${legacy}`] ?? "") || "Not provided";
  return (Object.keys(requestKinds) as RequestKind[]).filter(kind => choices.some(value => value === kind || value === requestKinds[kind].label || value === requestKinds[kind].short)).map(kind => ({
    kind, label: requestKinds[kind].short,
    facts: kind === "parking" ? [["Plate", detail("rsvp_car_plate", "parkingPlate")], ["Car", [values.rsvp_car_color ?? values["logisticalNeeds.parkingColor"], values.rsvp_car_model ?? values["logisticalNeeds.parkingModel"]].filter(Boolean).join(" ") || "Not provided"], ["Arriving", detail("rsvp_arrival", "parkingArrival")]] as Array<[string, string]> : kind === "dietary" ? [["Allergens", detail("rsvp_allergens", "dietaryAllergens")]] as Array<[string, string]> : [],
  }));
}
