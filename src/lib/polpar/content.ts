// Fields and declarations transcribed from POLPAR Forms 01–07.
export const requirements = [
  { id: "petition", label: "Form 01 — Petition for Registration", hint: "Signed by the party’s authorized representative.", template: "Form 01 - Petition for Registration.docx" },
  { id: "officers", label: "Form 02 — Roll of Officers", hint: "Include the certifying representative’s name and position.", template: "Form 02 - Roll of Officers.docx" },
  { id: "members", label: "Form 03 — Roll of Members", hint: "Include the member count and certification.", template: "Form 03 - Roll of Members.docx" },
  { id: "alumni", label: "Form 04 — List of Active Alumni", hint: "Submit the list, including a declaration if there are no active alumni.", template: "Form 04 - List of Active Alumni.docx" },
  { id: "affiliates", label: "Form 05 — Local Political Party Affiliates", hint: "Submit the list, including a declaration if there are no affiliates.", template: "Form 05 - Local Affiliates.docx" },
  { id: "registrationForms", label: "Officers’ and members’ registration forms", hint: "Clear copies for every listed officer and member." },
  { id: "studentIds", label: "Officers’ and members’ IDs", hint: "Clear copies for every listed officer and member." },
  { id: "alumniIds", label: "Alumni IDs", hint: "Clear copies for every listed active alumni member." },
  { id: "conforme", label: "Form 06 — Signed membership conformes", hint: "Include each applicant’s signature, printed name and date, and those of two witnesses.", template: "Form 06 - Conforme.docx" },
  { id: "constitution", label: "Constitution and By-Laws", hint: "The party’s Constitution and By-Laws." },
  { id: "platform", label: "Platform, political creed, or code of political ethics", hint: "Submit any one of these three alternatives." },
  { id: "financial", label: "Beginning financial statement", hint: "The party’s beginning financial statement." },
] as const;
export type RequirementId = typeof requirements[number]["id"];
export const templateHref = (name: string) => `/documents/polpar/${encodeURIComponent(name)}`;

export const petitionDeclaration = "The party declares not to pursue its goals through violence or other unlawful means; upholds and adheres to the Central Student Council Constitution and shall obey all laws, policies, and lawful orders promulgated by the University of Santo Tomas and other duly constituted authorities; and declares that it is not supported by, nor does it accept financial contributions or any aid from, persons not enrolled in the University and/or organizations not duly recognized by the University.";
export const communicationDeclaration = "I hereby declare that the information provided is true and correct. All forms of direct communication from the Commission shall be coursed through the contact numbers and email addresses provided. It shall be the party’s responsibility to inform the Commission of any changes to the information stated herein.";
export const conformeDeclarations = [
  "I have read the Constitution and By-Laws of my party and agree with the party’s ideology or political creed.",
  "I have complied with the requirements for membership demanded by the political party’s constitution.",
  "I am aware of my rights and obligations as a member and affirm my desire and qualification to be a member of this political party.",
  "I agree to abide by the current election code and other relevant laws stipulated in the UST Student Handbook.",
] as const;

export type RosterField = { key: string; label: string; type?: "email" | "tel" | "date" | "number" };
const name: RosterField = { key: "fullName", label: "Full name" };
const college: RosterField = { key: "college", label: "College / academic unit" };
const student: RosterField = { key: "studentNumber", label: "Student number" };
const contact: RosterField = { key: "contactNumber", label: "Contact number", type: "tel" };
const recruited: RosterField = { key: "recruitedAt", label: "Date of recruitment", type: "date" };
const email: RosterField = { key: "email", label: "Email address", type: "email" };
export const rosterSections = [
  { id: "officers", title: "Roll of officers", source: "Form 02", singular: "officer", fields: [{ key: "position", label: "Position" }, name, college, student, contact, email, recruited] },
  { id: "members", title: "Roll of members", source: "Form 03", singular: "member", fields: [name, college, student, contact, recruited] },
  { id: "alumni", title: "Active alumni members", source: "Form 04", singular: "alumni member", fields: [name, college, { key: "yearGraduated", label: "Year graduated", type: "number" }, contact] },
  { id: "affiliates", title: "Affiliated local political parties", source: "Form 05", singular: "affiliate", fields: [{ key: "name", label: "Name of affiliate" }, college, { key: "contactPerson", label: "Contact person’s full name" }, contact, email] },
] as const satisfies ReadonlyArray<{ id: string; title: string; source: string; singular: string; fields: RosterField[] }>;
export type RosterId = typeof rosterSections[number]["id"];

// Technical upload limits, not accreditation rules.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
export const uploadTypes = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } as const;
export const POLPAR_BUCKET = "party-registration";
