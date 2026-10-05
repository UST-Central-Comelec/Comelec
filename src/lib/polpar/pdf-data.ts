import { z } from "zod";
import { conformeSchema, partyRegistrationFields, type PartyRegistration } from "./schema";

export const pdfForms = [
  { id: "01", label: "Form 01 — Petition for Registration" },
  { id: "02", label: "Form 02 — Roll of Officers" },
  { id: "03", label: "Form 03 — Roll of Members" },
  { id: "04", label: "Form 04 — List of Active Alumni" },
  { id: "05", label: "Form 05 — Local Affiliates" },
  { id: "06", label: "Form 06 — Membership Conformes" },
  { id: "07", label: "Form 07 — Requirement Checklist" },
] as const;
export type PdfFormId = typeof pdfForms[number]["id"];
export type PdfSelection = PdfFormId | "all";
export type PdfInput = Omit<PartyRegistration, "petitionAccepted" | "recordsAccepted" | "conformeAccepted">;

// Exporting never requires uploads or claims that an unsigned document has been signed.
export const pdfPacketSchema = partyRegistrationFields.omit({ petitionAccepted: true, recordsAccepted: true, conformeAccepted: true }).extend({ conformes: z.array(conformeSchema).min(1, "Add at least one applicant to generate a membership conforme.") });
const shape = partyRegistrationFields.shape;
const party = { partyName: shape.partyName };
const certification = (key: "officers" | "members" | "alumni" | "affiliates") => z.object({ certifications: z.object({ [key]: shape.certifications.shape[key] }) });
const pdfSchemas = {
  "01": z.object({ ...party, unit: shape.unit, establishedAt: shape.establishedAt, headquarters: shape.headquarters, petitionDate: shape.petitionDate, petitionSignatory: shape.petitionSignatory }).superRefine((value, ctx) => {
    if (value.unit === "central" && !value.headquarters.trim()) ctx.addIssue({ code: "custom", path: ["headquarters"], message: "Enter the central party’s principal headquarters." });
    if (value.petitionDate < value.establishedAt) ctx.addIssue({ code: "custom", path: ["petitionDate"], message: "The petition date cannot precede establishment." });
  }),
  "02": z.object({ ...party, officers: shape.officers }).extend(certification("officers").shape),
  "03": z.object({ ...party, members: shape.members }).extend(certification("members").shape),
  "04": z.object({ ...party, alumni: shape.alumni }).extend(certification("alumni").shape),
  "05": z.object({ ...party, affiliates: shape.affiliates }).extend(certification("affiliates").shape),
  "06": z.object({ ...party, conformes: z.array(conformeSchema).min(1, "Add an applicant to generate a membership conforme.") }),
  "07": z.object({ ...party, contactPerson: shape.contactPerson, contactNumber: shape.contactNumber, email: shape.email, submittedBy: shape.submittedBy, submittedPosition: shape.submittedPosition }),
};

export function validatePdf(data: PdfInput, selection: PdfSelection) {
  if (selection !== "all") return pdfSchemas[selection].safeParse(data);
  const packet = pdfPacketSchema.safeParse(data);
  if (!packet.success) return packet;
  return pdfSchemas["01"].safeParse(data);
}
