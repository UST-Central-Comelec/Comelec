import { conflicts, divisions, preferredBodies, qualifications, yearLevels, type ConflictId, type DivisionId, type QualificationField } from "./options";
import { conflictFields, declaredConflicts, needsPortfolio, type ApplicationValues } from "./schema";

// Every answer on the form in words, grouped by step. The Review step shows it before submitting,
// and the Receipt step and the downloaded receipt show it after.

export type AnswerSectionId = "about" | "qualifications" | "application" | "documents" | "interview";

/** Rows are [label, value]; an empty value means the question wasn't answered. */
export type AnswerSection = { id: AnswerSectionId; title: string; rows: Array<[string, string]> };

/** Stands in for an interview time when the division has none open. */
export const interviewLater = "The commission will email you to schedule it";

/** `interview` is the booked time in words, or `interviewLater`, or "" when one still has to be picked. */
export function describeAnswers(values: ApplicationValues, interview: string): AnswerSection[] {
  const division = divisions[values.division as DivisionId];
  const declared = declaredConflicts(values);
  const allQualifications = (Object.keys(qualifications) as QualificationField[]).every((field) => values[field]);
  return [
    { id: "about", title: "About you", rows: [
      ["Name", [values.lastName && `${values.lastName.toUpperCase()},`, values.firstName.toUpperCase(), values.middleInitial && `${values.middleInitial.toUpperCase()}.`].filter(Boolean).join(" ")],
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
        return [conflicts[id].short, values[answerField] === "yes" ? `Yes, to resolve: ${values[detailField].trim()}` : values[answerField] === "no" ? "None" : ""];
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
      ["Endorsement letter", values.endorsementUrl],
      ...(needsPortfolio(values.division) ? [["Portfolio", values.portfolioUrl] as [string, string]] : []),
    ] },
    { id: "interview", title: "Interview", rows: [["Time", interview]] },
  ];
}
