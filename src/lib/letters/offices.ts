import { academicUnits, collegeSearchAliases, onReferenceChange, replaceArray, unitAbbreviations } from "@/lib/applications/options";

/**
 * University offices letters go to. The default: Administrative → Database → Admin Offices edits
 * it (src/lib/reference/data.ts).
 */
const startingOffices = [
  "Office of the Rector (OR)",
  "Office of the Vice-Rector (OVR)",
  "Office of the Vice-Rector for Academic Affairs (OVRAA)",
  "Office of the Vice-Rector for Research and Innovation (OVRRI)",
  "Office of the Vice-Rector for Religious Affairs (OVRRA)",
  "Office of the Vice-Rector for Finance (OVRF)",
  "Office of the Secretary-General (OSG)",
  "Office for Admissions (OFAD)",
  "Office of the Registrar",
  "Office for Student Affairs (OSA)",
  "Guidance and Counseling Center",
  "Career Services and Placement Office",
  "Health Service",
  "Miguel de Benavides Library",
  "Office for Faculty Evaluation and Development",
  "Center for Innovative Teaching and Educational Delivery",
  "Educational Technology Center (EDTECH)",
  "Language Center",
  "Office of Alumni Relations (OAR)",
  "Archives of the University of Santo Tomas",
  "Communications Bureau",
  "Human Resource Department",
  "Office of Information and Communications Technology (OICT)",
  "Santo Tomas e-Service Providers (STEPS)",
  "Office for Grants, Endowments, and Partnerships in Higher Education",
  "Office of International Relations and Programs (OIRP)",
  "Office of the Internal Auditor (OIA)",
  "Office of Planning and Quality Management (OPQM)",
  "Office of Public Affairs (OPA)",
  "Office of QS/THE Rankings",
  "UST Museum",
  "UST Publishing House",
  "Office of the University Data Protection Officer",
  "Accounting Division",
  "General Accounting",
  "Payroll",
  "Student Accounts",
  "Treasury Department",
  "Financial Planning and Business Development",
  "Facilities Management Office (FMO)",
  "Purchasing Office",
  "Laboratory Equipment and Supplies Office (LESO)",
  "Office of the Property Custodian (OPC)",
  "Campus Safety and Security Office (CSSO)",
  "General Shops and Merchandise / University Shops and Merchandise",
  "Center for Campus Ministry (CCC)",
  "UST SIMBAHAYAN Community Development Office",
  "Research Center for Culture, Arts, and the Humanities",
  "Research Center for Engineering and Technological Sciences",
  "Research Center for Health Sciences",
  "Research Center for Natural and Applied Sciences",
  "Research Center for Social Sciences and Education",
  "Research Center for Theology, Religious Studies, and Ethics",
  "Center for Health Research and Movement Science",
  "Center for Creative Writing and Literary Studies",
  "Innovation and Technology Support Office",
  "DOST–TOMASInno Center",
  "Institutional Research Ethics Board",
  "Graduate School–Center for Conservation of Cultural Property and Environment in the Tropics",
  "The Varsitarian",
  "Boletín Eclesiástico de Filipinasa",
  "Philippiniana Sacra",
];
export const universityOffices: string[] = [...startingOffices];

/** How letter destinations wrote the academic units before they came from the Database, to read old records. */
const previousLetterUnits = [
  "UST–Alfredo M. Velayo College of Accountancy (AMV)",
  "College of Architecture (ARKI)",
  "Faculty of Arts and Letters (AB)",
  "Faculty of Canon Law (CANON LAW)",
  "Faculty of Civil Law (CIVIL LAW, LAW)",
  "College of Commerce and Business Administration (COMMERCE, COM)",
  "College of Education (EDUC)",
  "Faculty of Engineering (ENGG)",
  "College of Fine Arts and Design (CFAD)",
  "Graduate School (GS)",
  "Graduate School of Law (GS Law)",
  "College of Information and Computing Sciences (CICS)",
  "Faculty of Medicine and Surgery (FMS, MED)",
  "Conservatory of Music (MUSIC, MUS)",
  "College of Nursing (NURSING, NUR)",
  "Faculty of Pharmacy (FOP, PHA)",
  "Faculty of Philosophy (Philosophy)",
  "Institute of Physical Education and Athletics (IPEA)",
  "College of Rehabilitation Sciences (CRS)",
  "Institute of Religion (IR)",
  "Faculty of Sacred Theology (THEO)",
  "College of Science (SCI)",
  "College of Tourism and Hospitality Management (CTHM)",
  "Senior High School (SHS)",
  "Junior High School (JHS)",
  "Education High School (EHS)",
];

/** A unit as a letter destination names it: "College of Science (COS, SCI)". */
export const letterUnitName = (unit: string) => {
  const short = [unitAbbreviations[unit], ...(collegeSearchAliases[unit] ?? [])].filter(Boolean);
  return short.length ? `${unit} (${short.join(", ")})` : unit;
};

/** Letter destinations include academic units even when they have no Local Comelec unit. */
export const letterFacultiesAndColleges: string[] = [];
/** Every suggested destination: the offices, then each unit's Dean and Regent. */
export const destinationOffices: string[] = [];
onReferenceChange(() => {
  replaceArray(letterFacultiesAndColleges, academicUnits.map(letterUnitName));
  replaceArray(destinationOffices, [
    ...universityOffices,
    ...letterFacultiesAndColleges.map(unit => `Dean of the ${unit}`),
    ...letterFacultiesAndColleges.map(unit => `Regent of the ${unit}`),
  ]);
});

/** Keep previously saved destinations selectable after names and abbreviations are updated. */
export function normalizeDestinationOffice(value: string): string {
  for (const role of ["Dean", "Regent"]) {
    if (!value.startsWith(`${role} of the `)) continue;
    const named = value.slice(`${role} of the `.length);
    const bare = named.replace(/ \([^)]*\)$/, "").replace(/^UST–/, "");
    const unit = academicUnits.find(item => item === bare);
    if (unit && (named === bare || previousLetterUnits.includes(named))) return `${role} of the ${letterUnitName(unit)}`;
  }
  return value;
}
