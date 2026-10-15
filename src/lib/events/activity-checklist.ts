// Generated from the UST e-ReSERVe document checklist (Checklist sheet) and templates sheet, 2026-10-15.
// Each nature of activity lists, per venue type, the documents e-ReSERVe asks for: required, then
// optional. A venue type that's missing isn't offered for that nature. Keep the fixed form codes in
// step with public.event_document_form_type (supabase/migrations/20261015000400_event_activity_checklist.sql).

export const venueTypes = {
  "in-campus": "In-campus",
  "off-campus-local": "Off-campus local",
  "off-campus-international": "Off-campus international",
  online: "Online",
} as const;

export type VenueType = keyof typeof venueTypes;

export const isVenueType = (value: unknown): value is VenueType => typeof value === "string" && Object.hasOwn(venueTypes, value);

/** A checklist document: its name, the university form code it carries, its template and where it's sent. */
export type ActivityDocument = { name: string; code?: string; template?: string; /** What a template kept on Drive opens as, for its icon. */ templateKind?: "docs" | "sheets" | "pdf"; office?: string };

export const activityDocuments: readonly ActivityDocument[] = [
  { name: "Acceptance Letter/ Invitation Letter from the partner university" },
  { name: "Accomplished Affidavit of Parental Consent" },
  { name: "Accomplished and Notarized Student Undertaking and Parental Consent", code: "UST:S030-00-FO30", template: "https://drive.google.com/file/d/1mcSAANLCN7Jp_pH8omOOJ222XYzvsbNi/view", templateKind: "pdf" },
  { name: "Accomplished Medical Report/Certificate" },
  { name: "Activity Form (SAAF)" },
  { name: "Advocacy Project Proposal", code: "UST:S040-00-FO38", template: "https://docs.google.com/document/d/1xdv82NQA9MVc5lNhO1GgpBrkw_FVZg8i/edit" },
  { name: "Affidavit of Parental Consent" },
  { name: "Approved Publicity Material/s" },
  { name: "Approved Script" },
  { name: "Budget Proposal", code: "UST:S030-00-FO130", template: "https://drive.google.com/file/d/16Hd7gMqTT5UEs1lf2A8JoOnbnYrRzoE7/view", templateKind: "sheets" },
  { name: "Certificate of Compliance", template: "https://docs.google.com/document/d/158njW9GJeeZdPB0jFs6hb7XpLkO0Bx2G/edit" },
  { name: "Certificate of Enrolment" },
  { name: "Certification of the Exhibit Materials" },
  { name: "Certification of the Film Material" },
  { name: "Clearance from Film Distributor" },
  { name: "Clearance from Streaming Service Company" },
  { name: "CMO no. 63 s. 2017 Personnel-In-Charge (PIC) Req. 11.2.a.1.6" },
  { name: "Colored Photocopy of Passport and VISA" },
  { name: "Community Development Project Proposal Form (Simbahayan)", code: "UST:S040-00-FO21", template: "https://docs.google.com/document/d/1od2zPNukZ-luHNo23qk9UK6QYuLcPYaa/edit" },
  { name: "Content Review / Review of Experts" },
  { name: "Contract / MOA (with food concessionaires)" },
  { name: "Contract / MOA (with Sponsors and/or suppliers)" },
  { name: "Copy of acknowledgment and approved letter from the LGUs" },
  { name: "Copy of Film" },
  { name: "Copy of the letter sent to the LGUs" },
  { name: "Course Plan" },
  { name: "Cover letter to OSA Director" },
  { name: "Curriculum Vitae of the Resource Person/s / Bionote" },
  { name: "Curriculum – Course Syllabus" },
  { name: "DepEd Order #66 s2017 compliance (Annex A Form)" },
  { name: "Emergency Preparedness Plan and Communication Protocols" },
  { name: "Emergency Preparedness Plan and Protocols Guideline for Implementers and Partner Communities" },
  { name: "Evaluation Form (with Qualitative and Quantitative measures)" },
  { name: "Evaluation Tool/Form" },
  { name: "Flight details (For Visayas and Mindanao Destination)" },
  { name: "Flight details / Sample Plane Ticket" },
  { name: "Floor plan of the venue" },
  { name: "Food Approval Form", code: "UST:S042-00-FO83", template: "https://drive.google.com/file/d/1l84KYIxSaM9kKuQZB5F4fq4bTurgXsbD/view", templateKind: "pdf", office: "Health Service" },
  { name: "IET CMO no. 26 s. 2015 Checklist (Annex A)" },
  { name: "Invitation from Organizer (in lieu of Project Proposal)" },
  { name: "Itinerary (e.g. Call time, ETD, ETA, & the like)" },
  { name: "Letter of Request from Organizer" },
  { name: "Letter to OVRF re: Concessionaires", office: "Office of the Vice-Rector for Finance (OVRF)" },
  { name: "Letter to Vice-Rector for Finance thru Campus Security and Safety Office (CSSO)", office: "Campus Safety and Security Office (CSSO)" },
  { name: "List of Awardees" },
  { name: "List of Guest/s" },
  { name: "List of Invited Schools" },
  { name: "List of Judges" },
  { name: "List of Participants" },
  { name: "List of Participants (IET)" },
  { name: "List of Performer/s" },
  { name: "List of project implementers / organizers - students and at least one (1) academic staff" },
  { name: "List of Speakers" },
  { name: "List of Students (Current Section)" },
  { name: "List of Submitted Reply Slip" },
  { name: "List of Titles (Synopsis), Ratings and Review certified by the Adviser" },
  { name: "List of Tutors and Assigned Subjects" },
  { name: "Map / Location Site" },
  { name: "Memorandum of Agreement" },
  { name: "Memorandum of Agreement with the Performer/s" },
  { name: "Name of Judges" },
  { name: "Parade Route" },
  { name: "Program / Activity Flow", template: "https://docs.google.com/document/d/1rYjFl1U4WbOHone0_60bclFaUJrgYH157RUDMJguLoY/edit" },
  { name: "Project Background" },
  { name: "Project Proposal Form (PPF)", code: "UST:S030-00-FO120", template: "https://drive.google.com/file/d/1e5uXEk4Cgch6NZtmaqPSKOlVVmJPo_GP/view", templateKind: "docs" },
  { name: "Rules / Regulations / Mechanics" },
  { name: "Sample copy of Student Undertaking and Parental Consent" },
  { name: "Sample Letter of Invitation" },
  { name: "Sample Medical Report / Certificate" },
  { name: "Script with authorized permission from the writer" },
  { name: "Sealed Transcript of Records" },
  { name: "Service Learning Project Proposal", code: "UST:S040-00-FO47", template: "https://docs.google.com/document/d/109mMvJq-GfoYQOGPj_5WOx8slx7ygwgH/edit" },
  { name: "SIAP CMO no. 22 s. 2013 - Internship Plan (Annex A)" },
  { name: "SIPP CMO no. 104 s. 2017 (Annex A-E)" },
  { name: "Student Undertaking and Parental Consent for Sports and Physical Activities", code: "UST:S030-00-FO90", template: "https://docs.google.com/document/d/158YkkluYAP9a6Q3VUA4QjR-WlFDG07F3/edit" },
  { name: "Team Building activities and/or challenges" },
  { name: "Tour Package / Registration / Joining Fee" },
  { name: "Transportation (Accredited or Not Accredited, Rented/Private)" },
  { name: "Travel Personal Accident Insurance" },
  { name: "Travel Personal Accident Insurance (For Non-UST Accredited Vehicle)" },
  { name: "Vehicle Reservation Form", code: "UST:S040-00-FO25", template: "https://docs.google.com/document/d/1hHUrKz1TuXDH5ZUMuSasn9JpSfsertFW/edit" },
];

/** Indices into activityDocuments: [required, optional]. */
const checklists: Record<string, Partial<Record<VenueType, readonly [readonly number[], readonly number[]]>>> = {
  "Advocacy": { "in-campus": [[80, 5, 7, 27, 31, 32, 43, 51], [36, 62]], "off-campus-international": [[4, 5, 6, 9, 16, 21, 29, 31, 35, 39, 40, 51, 68, 76, 78], []], "off-campus-local": [[3, 80, 2, 5, 16, 22, 24, 27, 31, 32, 40, 51, 57, 77], []], online: [[5, 7, 27, 31, 32, 51], []] },
  "Alumni Homecoming": { "in-campus": [[7, 9, 26, 33, 45, 48, 62, 64], [21, 27]], "off-campus-international": [[0, 4, 6, 9, 16, 26, 30, 35, 39, 40, 48, 62, 64, 68, 76, 78], []], "off-campus-local": [[4, 9, 16, 26, 30, 33, 35, 36, 39, 40, 48, 57, 62, 63, 64, 68, 66, 76, 77], []], online: [[7, 9, 26, 33, 48, 62, 64], [27]] },
  "Awarding Ceremonies": { "in-campus": [[7, 9, 26, 33, 44, 48, 62, 64], [27, 45]], "off-campus-international": [[4, 9, 16, 26, 30, 33, 35, 39, 40, 48, 60, 62, 64, 65, 68, 66, 76, 78], []], "off-campus-local": [[4, 9, 16, 26, 30, 33, 35, 36, 40, 48, 57, 60, 62, 63, 64, 65, 68, 66, 69, 76, 77], []], online: [[7, 9, 26, 33, 44, 48, 62, 64], [27, 45]] },
  "Canvassing and Proclamation": { "in-campus": [[7, 9, 26, 33, 45, 48, 62, 64], []], online: [[7, 9, 26, 33, 48, 62, 64], []] },
  "Ceremony": { "in-campus": [[7, 9, 26, 27, 33, 62, 64], []], "off-campus-local": [[3, 2, 16, 26, 30, 40, 48, 77], []] },
  "Community Development": { "in-campus": [[80, 7, 18, 27, 31, 32, 43, 51, 62], [36]], "off-campus-international": [[4, 6, 9, 16, 18, 29, 31, 35, 39, 40, 51, 68, 76, 78], []], "off-campus-local": [[3, 80, 2, 16, 18, 22, 24, 27, 31, 32, 40, 51, 57, 77], []], online: [[7, 18, 27, 31, 33, 51], []] },
  "Competition": { "in-campus": [[7, 9, 26, 33, 48, 60, 62, 64, 65], [27]], "off-campus-international": [[3, 2, 9, 16, 26, 30, 35, 39, 40, 48, 62, 65, 76, 78], []], "off-campus-local": [[3, 2, 9, 16, 26, 30, 33, 34, 39, 48, 62, 65, 77, 79], []], online: [[7, 9, 26, 33, 48, 62, 64, 65], [27, 39, 60]] },
  "Concert": { "in-campus": [[7, 9, 21, 26, 33, 48, 50, 55, 59, 62, 64], [36]], "off-campus-international": [[3, 2, 9, 16, 17, 26, 30, 35, 39, 40, 48, 62, 78], []], online: [[7, 9, 26, 33, 48, 50, 55, 59, 62, 64], [21]] },
  "Conference": { "in-campus": [[7, 9, 26, 27, 33, 45, 62, 63, 64, 67], []], "off-campus-international": [[3, 2, 9, 17, 26, 30, 35, 39, 40, 48, 57, 58, 62, 64, 76, 78], []], "off-campus-local": [[3, 2, 9, 16, 26, 30, 34, 39, 40, 48, 57, 62, 77, 79], []], online: [[7, 9, 26, 62, 64, 67], [27, 45]] },
  "Convention": { "in-campus": [[7, 9, 21, 26, 27, 33, 48, 62, 64], [45, 46]], "off-campus-international": [[3, 2, 6, 9, 16, 26, 30, 33, 35, 39, 40, 48, 57, 62, 64, 68, 76, 78], []], "off-campus-local": [[3, 2, 16, 26, 30, 34, 39, 40, 48, 57, 62, 76, 77, 79], []], online: [[7, 9, 26, 27, 48, 62, 64], [45, 46, 67]] },
  "E-Sports": { "in-campus": [[7, 9, 26, 33, 48, 60, 62, 64, 65], []], "off-campus-international": [[4, 6, 9, 16, 26, 30, 33, 35, 39, 40, 48, 62, 64, 65, 68, 74, 76, 78], []], "off-campus-local": [[4, 9, 16, 26, 30, 33, 35, 48, 57, 62, 63, 64, 65, 68, 74, 76], []], online: [[7, 9, 26, 33, 48, 60, 62, 64, 65], []] },
  "Educational Tour": { "in-campus": [[4, 9, 21, 26, 36, 41, 48, 62, 63, 64, 66], []], "off-campus-international": [[3, 2, 16, 17, 26, 28, 30, 35, 38, 40, 49, 57, 76, 78], []], "off-campus-local": [[3, 2, 16, 10, 22, 24, 26, 28, 29, 30, 34, 40, 48, 57, 77, 78], []] },
  "Elections": { "in-campus": [[7, 9, 26, 33, 48, 62, 64], []], online: [[7, 9, 26, 33, 48, 62, 64], []] },
  "Examination": { "in-campus": [[9, 26, 53, 64], []], "off-campus-international": [[4, 9, 26, 35, 39, 40, 48, 64, 68, 66, 76, 78], []], "off-campus-local": [[4, 9, 26, 35, 36, 40, 48, 57, 64, 68, 66, 76], []] },
  "Exhibit": { "in-campus": [[9, 12, 26, 27, 33, 36, 47, 48, 62, 64], []], "off-campus-international": [[4, 6, 9, 16, 26, 30, 33, 35, 36, 39, 40, 48, 62, 64, 68, 76, 78], []], "off-campus-local": [[4, 9, 16, 21, 26, 30, 33, 35, 36, 40, 48, 57, 62, 63, 64, 68, 66, 76, 77], []], online: [[7, 9, 12, 26, 27, 33, 48, 62, 64], []] },
  "Exposure Trip": { "in-campus": [[4, 9, 21, 26, 33, 36, 41, 48, 62, 63, 64, 66], []], "off-campus-international": [[1, 3, 4, 21, 26, 29, 30, 35, 38, 39, 40, 48, 62, 76, 78], []], "off-campus-local": [[3, 2, 16, 10, 21, 26, 29, 30, 34, 40, 48, 57, 62, 63, 64, 76, 77, 79], []] },
  "Fieldwork": { "in-campus": [[4, 9, 26, 33, 48, 57, 63, 64, 68, 66], []], "off-campus-international": [[4, 6, 26, 30, 33, 35, 39, 40, 48, 64, 68, 76, 78], []], "off-campus-local": [[3, 2, 16, 10, 22, 24, 26, 28, 30, 35, 40, 48, 57, 76, 77, 78], []] },
  "Filing of Certificate of Candidacy": { "in-campus": [[7, 9, 26, 33, 48, 62, 64], []], online: [[7, 9, 26, 33, 48, 62, 64], []] },
  "Film Showing": { "in-campus": [[7, 9, 14, 21, 23, 26, 33, 48, 55, 62, 63, 64, 69], []], "off-campus-international": [[4, 6, 9, 23, 26, 33, 35, 39, 40, 48, 62, 64, 68, 69, 76, 78], []], "off-campus-local": [[4, 9, 23, 26, 30, 33, 40, 48, 57, 62, 63, 64, 68, 66, 69, 76, 77], []], online: [[7, 9, 13, 14, 15, 26, 33, 48, 55, 62, 64], []] },
  "Food Concessionaires": { "in-campus": [[7, 9, 20, 32, 37, 42, 62, 64], []] },
  "General Assembly": { "in-campus": [[7, 9, 26, 27, 33, 48, 62, 64], []], "off-campus-local": [[3, 2, 26, 30, 34, 39, 40, 48, 57, 77, 79], []], online: [[7, 9, 26, 33, 48, 62, 64], [27, 45]] },
  "Investiture / Graduation": { "in-campus": [[4, 9, 26, 33, 36, 62, 63, 64], []], "off-campus-international": [[4, 6, 9, 16, 26, 30, 33, 35, 39, 40, 48, 64, 68, 76, 78], []], "off-campus-local": [[4, 9, 16, 26, 30, 33, 35, 36, 40, 48, 57, 62, 63, 64, 68, 66, 76, 77], []] },
  "Leadership Training Seminar": { "in-campus": [[7, 9, 26, 27, 32, 33, 36, 62, 64, 65], []], "off-campus-local": [[3, 80, 2, 9, 16, 26, 27, 30, 32, 34, 35, 48, 52, 57, 62, 64, 75, 77, 79], []] },
  "Medical / Health Activities": { "in-campus": [[9, 26, 33, 36, 45, 48, 62, 63, 64], []], "off-campus-international": [[4, 6, 9, 16, 26, 30, 33, 35, 39, 40, 48, 64, 68, 76, 78], []], "off-campus-local": [[4, 9, 16, 26, 30, 33, 36, 48, 54, 62, 63, 64, 68, 66, 77], []], online: [[7, 9, 26, 27, 33, 48, 64], []] },
  "Meeting": { "in-campus": [[7, 9, 26, 27, 33, 48, 62, 64], []], online: [[7, 9, 26, 48, 62, 64], []] },
  "Merch Selling/Bazaar": { "in-campus": [[7, 9, 33, 36, 42, 62, 64], [21, 27]], "off-campus-local": [[9, 26, 62, 64], []], online: [[7, 9, 27, 32, 62, 64], []] },
  "Miting de Avance": { "in-campus": [[7, 9, 26, 33, 36, 48, 62, 64], []], online: [[7, 9, 26, 33, 48, 62, 64], []] },
  "Oath Taking": { "in-campus": [[7, 9, 26, 27, 33, 48, 62, 64], []], online: [[7, 9, 26, 33, 48, 62, 64], []] },
  "OJT": { "in-campus": [[21, 33, 54, 63, 66], []], "off-campus-international": [[6, 21, 26, 30, 33, 35, 39, 40, 48, 68, 76, 78], []], "off-campus-local": [[16, 10, 21, 26, 30, 33, 40, 48, 54, 57, 68, 66], []] },
  "Orientation": { "in-campus": [[7, 9, 26, 27, 33, 45, 48, 62, 64], []], "off-campus-local": [[3, 2, 16, 40, 48], [57]], online: [[7, 9, 26, 27, 45, 48, 62, 64], []] },
  "Parade": { "in-campus": [[7, 9, 26, 33, 48, 61, 62, 64, 65], []], "off-campus-international": [[6, 16, 30, 33], []], "off-campus-local": [[16, 30, 33, 63, 77], []] },
  "Plebiscite": { "in-campus": [[7, 9, 26, 48, 62, 64], [27]], online: [[7, 9, 26, 48, 62, 64], []] },
  "Podcast": { "in-campus": [[7, 8, 9, 26, 27, 33, 45, 48, 62, 64], []], online: [[7, 8, 9, 26, 27, 33, 45, 48, 62, 64], []] },
  "Political Party Accreditation and Registration": { "in-campus": [[9, 26, 33, 48, 62, 63, 64], []], online: [[7, 9, 26, 33, 48, 62, 64], []] },
  "Political Party Exposition": { "in-campus": [[7, 9, 26, 33, 48, 62, 64], []], online: [[7, 9, 26, 33, 48, 62, 64], []] },
  "Quiz Bee": { "in-campus": [[7, 9, 26, 27, 33, 48, 60, 62, 64, 65], []], "off-campus-international": [[4, 6, 9, 16, 26, 30, 33, 35, 39, 40, 48, 60, 62, 64, 65, 76, 78], []], "off-campus-local": [[3, 2, 9, 16, 26, 30, 35, 39, 40, 48, 57, 60, 62, 65, 76, 77], []], online: [[7, 9, 26, 27, 33, 48, 60, 62, 63, 64], []] },
  "Recruitment": { "in-campus": [[7, 9, 26, 27, 33, 36, 48, 62, 64], []], online: [[7, 9, 26, 33, 48, 62, 64], []] },
  "Related Learning Experience (RLE)": { "in-campus": [[63], []], "off-campus-international": [[4, 6, 30, 35, 40, 48, 76, 78], []], "off-campus-local": [[3, 2, 16, 10, 22, 24, 26, 28, 30, 34, 35, 40, 48, 57, 77, 78, 79], []] },
  "Religious Activity": { "in-campus": [[7, 9, 26, 27, 33, 45, 48, 62, 63, 64], []], "off-campus-international": [[4, 6, 9, 16, 26, 30, 33, 35, 39, 40, 48, 64, 68, 76, 78], []], "off-campus-local": [[3, 2, 9, 16, 26, 30, 40, 48, 57, 62, 77, 78], []], online: [[7, 9, 26, 48, 62, 64], []] },
  "Review Classes": { "in-campus": [[9, 26, 27, 33, 48, 56, 62, 63, 64], []], "off-campus-international": [[4, 6, 9, 16, 26, 30, 33, 35, 39, 40, 48, 64, 65, 68, 76, 78], []], "off-campus-local": [[4, 9, 16, 26, 30, 33, 35, 36, 40, 48, 57, 62, 63, 64, 65, 68, 66, 76, 77], []], online: [[7, 9, 26, 27, 33, 48, 62, 63, 64], []] },
  "Seminar / Lecture / Symposium": { "in-campus": [[7, 9, 26, 27, 33, 36, 45, 48, 62, 64, 67], []], "off-campus-international": [[4, 9, 26, 35, 39, 40, 48, 57, 64, 76, 78], [3, 2]], "off-campus-local": [[3, 2, 9, 16, 10, 26, 34, 36, 39, 48, 62, 77, 79], []], online: [[7, 9, 26, 27, 33, 48, 62, 64, 67], []] },
  "Service Learning": { "in-campus": [[80, 25, 27, 33, 51, 71], [36, 62]], "off-campus-international": [[6, 9, 16, 31, 35, 39, 40, 68, 71], []], "off-campus-local": [[3, 80, 2, 16, 10, 22, 24, 25, 27, 31, 32, 40, 51, 57, 71, 78], []], online: [[25, 27, 31, 32, 51, 71], []] },
  "Social Media Posting / Campaign / Website": { "in-campus": [[7, 9, 26, 48, 62], []], online: [[7, 12, 26, 33, 48, 62, 64], []] },
  "Sports / Physical Activity": { "in-campus": [[7, 9, 26, 33, 48, 62, 64, 65, 74], []], "off-campus-local": [[3, 2, 9, 26, 48, 54, 62, 64, 68], []] },
  "Stage / Theatre Presentation / Variety Show": { "in-campus": [[7, 8, 9, 19, 26, 50, 62, 64, 69], []], "off-campus-local": [[3, 2, 9, 16, 26, 30, 39, 40, 48, 55, 57, 62, 64, 77, 78], []], online: [[4, 7, 8, 9, 26, 33, 48, 55, 62, 64, 69], []] },
  "Team Building": { "in-campus": [[9, 26, 27, 33, 48, 62, 63, 64, 65, 74, 75], []], "off-campus-international": [[1, 3, 9, 16, 26, 30, 35, 40, 48, 76, 78], []], "off-campus-local": [[3, 2, 16, 26, 30, 33, 40, 48, 62, 64, 75, 77], []], online: [[7, 9, 26, 27, 33, 48, 62, 64, 75], []] },
  "Training": { "in-campus": [[7, 9, 26, 27, 33, 48, 62, 64], []], "off-campus-international": [[3, 6, 9, 16, 26, 27, 30, 33, 35, 39, 40, 48, 64, 68, 76, 78], []], "off-campus-local": [[3, 2, 9, 16, 26, 27, 30, 33, 35, 36, 40, 48, 57, 63, 64, 68, 66, 76, 77], []], online: [[7, 9, 26, 27, 33, 48, 62, 64], []] },
  "Tutorial Review Sessions": { "in-campus": [[7, 9, 26, 33, 45, 48, 62, 64], [27, 56]], online: [[7, 9, 27, 48, 56], []] },
  "Workshop": { "in-campus": [[7, 9, 26, 27, 33, 48, 62, 64], []], "off-campus-international": [[4, 6, 9, 16, 26, 27, 30, 33, 35, 39, 40, 48, 62, 64, 68, 76, 78], []], "off-campus-local": [[9, 16, 26, 30, 33, 40, 48, 57, 62, 63, 64, 68, 76, 77], [3, 2, 34, 79]], online: [[7, 9, 26, 27, 33, 48, 62, 64], []] },
  "Year-End Assembly Org Meeting": { "in-campus": [[7, 9, 26, 27, 33, 45, 48, 62, 64], []], online: [[7, 9, 26, 27, 33, 45, 48, 62, 64], []] },
  "Practicum / OJT / Fieldwork": { "off-campus-international": [[0, 3, 2, 11, 17, 26, 28, 30, 35, 40, 48, 58, 72, 70, 76, 78], []], "off-campus-local": [[3, 2, 16, 10, 22, 24, 26, 28, 30, 40, 48, 57, 58, 73, 77, 78], []] },
  "Student Internship Abroad Program": { "off-campus-international": [[1, 3, 16, 11, 25, 26, 28, 31, 35, 40, 48, 57, 72, 78], []] },
  "Student Mobility Program": { "off-campus-international": [[0, 1, 3, 16, 17, 25, 26, 30, 35, 40, 48, 58, 78], []] },
  "Contract/MOA Signing": { "off-campus-local": [[3, 2, 16, 26, 30, 39, 40, 48, 62, 77], []] },
  "Inurnment (Medicine and Surgery)": { "off-campus-local": [[3, 2, 26, 30, 40, 48, 57, 77], []] },
  "Mountaineering": { "off-campus-local": [[], [3, 2, 9, 16, 22, 24, 26, 30, 33, 40, 48, 57, 64, 77]] },
  "Retreat / Recollection": { "off-campus-local": [[3, 2, 16, 26, 30, 48, 57, 62, 65, 77], []], online: [[4, 7, 9, 26, 27, 33, 48, 62, 63, 64], []] },
  "Special Coverage": { "off-campus-local": [[3, 2, 16, 26, 30, 40, 48, 77, 78], []] },
};

/** Every nature of activity e-ReSERVe has a checklist for, alphabetically. */
export const activityNatures = Object.keys(checklists).sort((a, b) => a.localeCompare(b));

/** The natures offered for a venue type. */
export const naturesFor = (venueType: VenueType) => activityNatures.filter(nature => checklists[nature][venueType]);

export const isActivityNature = (value: unknown, venueType: VenueType): value is string => typeof value === "string" && Boolean(checklists[value]?.[venueType]);

/** The documents an activity needs, required first, in the checklist's order. */
export function activityChecklist(venueType: VenueType, nature: string): Array<ActivityDocument & { required: boolean }> {
  const entry = checklists[nature]?.[venueType];
  if (!entry) return [];
  return [...entry[0].map(index => ({ ...activityDocuments[index], required: true })), ...entry[1].map(index => ({ ...activityDocuments[index], required: false }))];
}

const byName = new Map(activityDocuments.map(document => [document.name.toLowerCase(), document]));

/** A checklist document by its name, as an event document's type. */
export const activityDocument = (name: string) => byName.get(name.trim().toLowerCase());
