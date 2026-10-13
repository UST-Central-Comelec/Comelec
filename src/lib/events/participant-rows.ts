import type { RegistrantRow } from "@/components/portal/registrants-table";
import type { EventEditRequest } from "./edit-requests";
import type { EvaluationResponse } from "./evaluation";
import { rsvpRespondent, type RsvpResponse } from "./rsvp";

/** Join identified responses without associating anonymous evaluations with a person. */
export function mergeParticipantRows(registrations: RegistrantRow[], rsvps: RsvpResponse[], evaluations: EvaluationResponse[], editRequests: EventEditRequest[] = []): RegistrantRow[] {
  const rows = registrations.map(row => ({ ...row, registered: true, rsvp: null as RsvpResponse | null }));
  const byEmail = new Map(rows.map(row => [row.email.trim().toLowerCase(), row]));
  const blank = (id: string, signedUp: string): RegistrantRow => ({ id, registered: false, referenceCode: "—", attendanceConfirmedAt: null, evaluation: null, name: "", lastName: "", firstName: "", middleName: "", email: "", verified: false, sex: "", age: null, studentNumber: null, affiliation: "", affiliationSummary: "", affiliationFacts: [], attending: { label: "", facts: [] }, requests: [], status: "registered", signedUp });
  const when = (date: string) => new Date(date).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  const result: RegistrantRow[] = [...rows];
  for (const response of rsvps) {
    const person = rsvpRespondent(response.answers);
    const existing = person.email ? byEmail.get(person.email.trim().toLowerCase()) : undefined;
    if (existing) { existing.rsvp = response; continue; }
    result.push({ ...blank(`rsvp:${response.id}`, when(response.created_at)), rsvp: response, referenceCode: response.reference_code ?? "—", name: person.name || "RSVP response", lastName: person.lastName, firstName: person.firstName, middleName: person.middleName, email: person.email, studentNumber: person.studentNumber || null, affiliation: person.affiliation, affiliationSummary: person.organization || person.affiliation });
  }
  for (const response of evaluations) {
    const existing = !response.anonymous && rows.find(row => row.id === response.registration_id);
    if (existing) { existing.evaluation = response; continue; }
    result.push({ ...blank(`evaluation:${response.id}`, when(response.created_at)), evaluation: response, name: response.anonymous ? "Anonymous response" : "Evaluation response", affiliationSummary: response.anonymous ? "Anonymous" : "Registration unavailable" });
  }
  return result.map(row => ({ ...row, editRequests: editRequests.filter(request => request.registration_id === row.id || (row.rsvp && request.rsvp_response_id === row.rsvp.id)) }));
}
