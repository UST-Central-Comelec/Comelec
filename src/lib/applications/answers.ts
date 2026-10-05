import { conflicts, divisions, preferredBodies, qualifications, yearLevels, type ConflictId, type DivisionId, type QualificationField } from "./options";
import { conflictFields, declaredConflicts, type ApplicationValues } from "./schema";
import { interviewModes, slotDate, slotTimeRange, type InterviewSlot } from "./interview-format";

// Every answer on the form in words, grouped by step. The Review step shows it before submitting,
// and the Receipt step and the downloaded receipt show it after.

export type AnswerSectionId = "about" | "qualifications" | "application" | "documents" | "interview";

/** Rows are [label, value]; an empty value means the question wasn't answered. */
export type AnswerSection = { id: AnswerSectionId; title: string; rows: Array<[string, string]> };

/** Stands in for an interview time when the division has none open. */
export const interviewLater = "The commission will email you to schedule it";

/** `interview` is the booked slot, or `interviewLater`, or "" when one still has to be picked. */
export function describeAnswers(values: ApplicationValues, interview: Pick<InterviewSlot, "startsAt" | "durationMinutes" | "mode" | "location"> | typeof interviewLater | ""): AnswerSection[] {
  const division = divisions[values.division as DivisionId];
  const declared = declaredConflicts(values);
  const allQualifications = (Object.keys(qualifications) as QualificationField[]).every((field) => values[field]);
  return [
    { id: "about", title: "About you", rows: [
      ["Name", [values.lastName && `${values.lastName.toUpperCase()},`, values.firstName.toUpperCase(), values.middleName.toUpperCase()].filter(Boolean).join(" ")],
      ["Student number", values.studentNumber],
      ["Mobile number", values.contactNumber],
      ["UST email", values.email],
      ["Facebook", values.facebookUrl],
      ["College or faculty", values.college],
      ["Program", values.program],
      ["Year level", yearLevels[values.yearLevel as keyof typeof yearLevels] ?? ""],
    ] },
    { id: "qualifications", title: "Qualifications", rows: [
      ["Requirements", allQualifications ? "Meets all four" : ""],
      ...(Object.keys(conflicts) as ConflictId[]).map((id): [string, string] => {
        const [answerField, detailField] = conflictFields[id];
        const detail = values[detailField].trim();
        return [conflicts[id].short, values[answerField] === "yes" ? (id === "office" ? detail : `Yes, to resolve: ${detail}`) : values[answerField] === "no" ? "None" : ""];
      }),
      ...(declared.length ? [["Pledge", values.conflictPledge ? "Will resolve before taking office" : ""] as [string, string]] : []),
    ] },
    { id: "application", title: "Position", rows: [
      ["Serve in", preferredBodies[values.preferredBody as keyof typeof preferredBodies] ?? ""],
      ["Division", division?.label ?? ""],
      ["Position", (division?.positions as Record<string, string> | undefined)?.[values.position] ?? ""],
    ] },
    { id: "documents", title: "Documents", rows: [
      ["CV or résumé", values.cvUrl],
      ["Latest Registration Form", values.registrationFormUrl],
      ["Letter of Intent", values.letterOfIntentUrl],
      ["Recommendation Letter", values.endorsementUrl],
      ["Portfolio", values.portfolioUrl],
      ["Latest Copy of Grades", values.gradesUrl],
    ] },
    { id: "interview", title: "Interview", rows: interview === interviewLater ? [["Schedule", interviewLater]] : [
      ["Date", interview ? slotDate(interview.startsAt) : ""],
      ["Time", interview ? slotTimeRange(interview.startsAt, interview.durationMinutes) : ""],
      ["Mode", interview ? interviewModes[interview.mode] : ""],
      ...(interview && interview.location ? [["Location", interview.location] as [string, string]] : []),
    ] },
  ];
}
