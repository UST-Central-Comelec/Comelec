import { yearLevels } from "@/lib/applications/options";
import { affiliationLabels, attendingChoices } from "./options";
import type { Registration } from "./registrations";

export type RegistrationDetailGroup = { label: string; facts: Array<[string, string]> };

/** The same affiliation and participation information in registrant modals and booth previews. */
export function affiliationDetails(person: Registration): RegistrationDetailGroup {
  const facts: Array<[string, string]> = person.affiliation === "ust-student"
    ? [["University", "University of Santo Tomas"], ["College / Faculty", person.college || "Not given"], ["Program", person.program || "Not given"], ["Year level", yearLevels[person.yearLevel as keyof typeof yearLevels] ?? "Not given"]]
    : person.affiliation === "ust-staff"
      ? [["University", "University of Santo Tomas"], ["College / Faculty / Office", person.office || "Not given"]]
      : [["University / Institution", person.institution || "Not given"]];
  return { label: affiliationLabels[person.affiliation], facts };
}

export function participationDetails(person: Registration): RegistrationDetailGroup {
  if (person.attendingAs !== "representative") return { label: attendingChoices.independent, facts: [] };
  const facts: Array<[string, string | null]> = [["Organization", person.organizationName], ["Position", person.organizationPosition], ["Committee", person.organizationCommittee]];
  return { label: attendingChoices.representative, facts: facts.filter((fact): fact is [string, string] => Boolean(fact[1]?.trim())) };
}
