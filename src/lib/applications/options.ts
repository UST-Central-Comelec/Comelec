import { centralRoles } from "@/lib/data/types";
import { localRolesByCollege } from "@/lib/data/local-roles";

// Choices shown on the commissioner application form.
// Colleges and programs come from ust.edu.ph (Faculties, Colleges, Institutes, and Schools, and
// each college's own page), undergraduate and first professional degrees only, as of September 2026.
// The database checks year level and preferred body (supabase/migrations/0004_applications.sql),
// so keep those keys in sync.

const bs = (name: string) => `Bachelor of Science in ${name}`;
const ab = (name: string) => `Bachelor of Arts in ${name}`;
const performance = (instrument: string) => `Bachelor of Music in Performance, major in ${instrument}`;

export const programsByCollege = {
  "Education High School": [],
  "Junior High School": [],
  "Senior High School": [
    "Science, Technology, Engineering, and Mathematics (STEM)",
    "Accountancy, Business, and Management (ABM)",
    "General Academics Strand (GAS)",
    "Health-Allied and Wellness (HA)",
    "Humanities and Social Sciences (HUMSS)",
    "Music, Arts, and Design (MAD)",
    "Physical Education and Sports (PES)",
    "Information and Communications Technology (ICT)",
    "Home Economics (HE)",
    "Industrial Arts (IA)",
    "Agri-Fishery Arts (AFA)",
    "Others",
  ],
  "Alfredo M. Velayo College of Accountancy": [bs("Accountancy"), bs("Accounting Information System"), bs("Management Accounting")],
  "College of Architecture": [bs("Architecture")],
  "Faculty of Arts and Letters": [
    ab("Asian Studies"), ab("Behavioral Science"), ab("Communication"), ab("Creative Writing"), ab("Economics"), ab("English Language Studies"),
    ab("History"), ab("Journalism"), ab("Legal Management"), ab("Literature"), ab("Philosophy"), ab("Political Science"), ab("Sociology"),
  ],
  "Faculty of Canon Law": ["Bachelor of Canon Law", "Licentiate in Canon Law"],
  "Faculty of Civil Law": ["Juris Doctor"],
  "College of Commerce and Business Administration": [
    `${bs("Business Administration")}, major in Business Economics`,
    `${bs("Business Administration")}, major in Financial Management`,
    `${bs("Business Administration")}, major in Human Resource Management`,
    `${bs("Business Administration")}, major in Marketing Management`,
    bs("Entrepreneurship"),
  ],
  "College of Education": [
    "Bachelor of Early Childhood Education",
    "Bachelor of Elementary Education",
    "Bachelor of Secondary Education, major in Biological Sciences",
    "Bachelor of Secondary Education, major in English",
    "Bachelor of Secondary Education, major in Filipino",
    "Bachelor of Secondary Education, major in Mathematics",
    "Bachelor of Secondary Education, major in Religious and Values Education",
    "Bachelor of Secondary Education, major in Science",
    "Bachelor of Secondary Education, major in Social Studies",
    "Bachelor of Special Needs Education, major in Early Childhood Education",
    "Bachelor of Library and Information Science",
    bs("Food Technology"),
    bs("Nutrition and Dietetics"),
  ],
  "Faculty of Engineering": [bs("Chemical Engineering"), bs("Civil Engineering"), bs("Electrical Engineering"), bs("Electronics Engineering"), bs("Industrial Engineering"), bs("Mechanical Engineering")],
  "College of Fine Arts and Design": ["Bachelor of Fine Arts, major in Advertising Arts", "Bachelor of Fine Arts, major in Industrial Design", "Bachelor of Fine Arts, major in Painting", bs("Interior Design")],
  "College of Information and Computing Sciences": [
    `${bs("Computer Science")}, specialization in Core Computer Science`,
    `${bs("Computer Science")}, specialization in Data Science`,
    `${bs("Computer Science")}, specialization in Game Development`,
    `${bs("Information Systems")}, specialization in Business Analytics`,
    `${bs("Information Systems")}, specialization in Service Management`,
    `${bs("Information Technology")}, specialization in Automation`,
    `${bs("Information Technology")}, specialization in Network and Security`,
    `${bs("Information Technology")}, specialization in Web and Mobile Development`,
  ],
  "Faculty of Medicine and Surgery": [bs("Basic Human Studies"), "Doctor of Medicine"],
  "Conservatory of Music": [
    "Bachelor of Music in Composition", "Bachelor of Music in Jazz", "Bachelor of Music in Musicology", "Bachelor of Music in Music Education",
    "Bachelor of Music in Music Technology", "Bachelor of Music in Music Theatre",
    ...["Bassoon", "Choral Conducting", "Clarinet", "Double Bass", "Flute", "French Horn", "Guitar", "Oboe", "Orchestral Conducting", "Percussion", "Piano", "Saxophone", "Trombone", "Trumpet", "Tuba", "Viola", "Violin", "Violoncello", "Voice"].map(performance),
  ],
  "College of Nursing": [bs("Nursing")],
  "Faculty of Pharmacy": [bs("Biochemistry"), bs("Medical Technology"), bs("Pharmacy"), `${bs("Pharmacy")}, major in Clinical Pharmacy`],
  "Faculty of Philosophy": ["Bachelor of Philosophy", "Licentiate in Philosophy"],
  "Institute of Physical Education and Athletics": [bs("Fitness and Sports Management")],
  "College of Rehabilitation Sciences": [bs("Occupational Therapy"), bs("Physical Therapy"), bs("Speech-Language Pathology"), bs("Sports Science")],
  "Faculty of Sacred Theology": ["Bachelor of Sacred Theology", "Licentiate in Sacred Theology"],
  "College of Science": [
    `${bs("Applied Mathematics")}, major in Actuarial Science`,
    `${bs("Applied Physics")}, major in Instrumentation`,
    `${bs("Biology")}, major in Environmental Biology`,
    `${bs("Biology")}, major in Industrial Biology`,
    `${bs("Biology")}, major in Medical Biology`,
    `${bs("Biology")}, major in Molecular Biology and Biotechnology`,
    bs("Chemistry"), bs("Data Science and Analytics"), bs("Microbiology"), bs("Psychology"),
  ],
  "College of Tourism and Hospitality Management": [
    `${bs("Hospitality Management")}, major in Culinary Entrepreneurship`,
    `${bs("Hospitality Management")}, major in Hospitality Leadership`,
    `${bs("Tourism Management")}, major in Cultural Heritage Management`,
    `${bs("Tourism Management")}, major in Recreation and Leisure Management`,
    `${bs("Tourism Management")}, major in Travel Operation and Service Management`,
  ],
} as const satisfies Record<string, readonly string[]>;

export type College = keyof typeof programsByCollege;

export const colleges = (Object.keys(programsByCollege) as College[]).sort((a, b) => a.localeCompare(b));

/** Every academic unit with a Local Comelec, including the three high schools. */
export const comelecUnits: readonly string[] = colleges;

/** Each unit's short name, as the commission writes it: what lists show in place of the full name. */
export const unitAbbreviations: Readonly<Record<string, string>> = {
  "Alfredo M. Velayo College of Accountancy": "AMV",
  "College of Architecture": "ARCHI",
  "Faculty of Arts and Letters": "AB",
  "Faculty of Civil Law": "FCL",
  "College of Commerce and Business Administration": "CCBA",
  "College of Education": "EDUC",
  "Faculty of Engineering": "FOE",
  "College of Fine Arts and Design": "CFAD",
  "College of Information and Computing Sciences": "CICS",
  "Faculty of Medicine and Surgery": "FMS",
  "Conservatory of Music": "MUSIC",
  "College of Nursing": "NURSING",
  "Faculty of Pharmacy": "PHARMA",
  "Institute of Physical Education and Athletics": "IPEA",
  "College of Rehabilitation Sciences": "CRS",
  "College of Science": "COS",
  "College of Tourism and Hospitality Management": "CTHM",
  "Faculty of Canon Law": "CANON LAW",
  "Faculty of Philosophy": "PHILO",
  "Faculty of Sacred Theology": "SACRED THEO",
  "Senior High School": "SHS",
  "Junior High School": "JHS",
  "Education High School": "EHS",
};


/**
 * Applications are deleted this many days after they're submitted (the nightly job in
 * supabase/migrations/0007_application_retention.sql); the site hides them from that moment.
 */
export const APPLICATION_RETENTION_DAYS = 60;

/** The oldest submission time still kept, as an ISO string for queries. */
export const retentionCutoff = (now = Date.now()) => new Date(now - APPLICATION_RETENTION_DAYS * 86_400_000).toISOString();

const collegeYearLevels = { "1": "1st year", "2": "2nd year", "3": "3rd year", "4": "4th year", "5": "5th year", swis: "SWIS" } as const;
const juniorGrades = { "7": "Grade 7", "8": "Grade 8", "9": "Grade 9", "10": "Grade 10" } as const;
const seniorGrades = { "11": "Grade 11", "12": "Grade 12" } as const;
/** All stored levels, for display; forms use yearLevelsFor for the selected school. */
export const yearLevels = { ...collegeYearLevels, ...juniorGrades, ...seniorGrades } as const;

export const programLocked = (college: string | null | undefined) => college === "Education High School" || college === "Junior High School";

export function yearLevelsFor(college: string | null | undefined): Readonly<Record<string, string>> {
  return college === "Junior High School" ? juniorGrades : college === "Senior High School" ? seniorGrades : collegeYearLevels;
}

export const isYearLevelFor = (college: string, level: string) => Object.hasOwn(yearLevelsFor(college), level);

export const preferredBodies = {
  central: "Central Comelec",
  local: "Local Comelec",
} as const;

export const preferredBodyDescriptions: Record<keyof typeof preferredBodies, string> = {
  central: "Run university-wide elections with the central commission.",
  local: "Serve the local commission of your own college.",
};

/**
 * Qualifications applicants confirm on the Qualifications step, by form field. Being a bona fide
 * student isn't here: verifying with a UST Google account confirms it.
 */
export const qualifications = {
  meetsUnits: "Enrolled in at least 15 units, not counting P.E. and NSTP.",
  meetsGwa: "General weighted average of at least 2.50, or 2.75 for the Faculty of Civil Law and the Faculty of Medicine and Surgery.",
  notRecentCandidate: "Not a candidate for any elective position in the immediately preceding elections.",
} as const;

export type QualificationField = keyof typeof qualifications;

/**
 * Conflicts that don't disqualify an applicant but have to be resolved before they take office.
 * The ids are saved with the application (supabase/migrations/0013_application_conflicts.sql).
 */
export const conflicts = {
  office: {
    question: "Do you hold any other office in the University?",
    rule: "Members of the commission can’t hold any other office in the University during their term.",
    resolve: "Should you be appointed, we’ll ask you to step down from this office before your term with the commission begins.",
    detailLabel: "Which office, and in which organization?",
    detailPlaceholder: "Treasurer, CICS Student Council",
    short: "Other office",
  },
  party: {
    question: "Are you affiliated with a political party, fraternity or sorority in the University?",
    rule: "Members of the commission can’t be affiliated with any political party, fraternity or sorority in the University.",
    resolve: "Should you be appointed, we’ll ask you to end this affiliation before your term with the commission begins, and to remain unaffiliated while you serve.",
    detailLabel: "Which party, fraternity or sorority?",
    detailPlaceholder: "Name of the party, fraternity or sorority",
    short: "Party, fraternity or sorority",
  },
  politics: {
    question: "Are you affiliated with any society, association or organization that is directly or indirectly involved in politics?",
    rule: "The USEC also bars members of the commission from any society, association or organization directly or indirectly involved in politics.",
    resolve: "Should you be appointed, we’ll ask you to step away from this organization before your term with the commission begins, and to remain apart from it while you serve.",
    detailLabel: "Which organization?",
    detailPlaceholder: "Name of the society, association or organization",
    short: "Political organization",
  },
} as const;

export type ConflictId = keyof typeof conflicts;

export const isConflictId = (value: unknown): value is ConflictId => typeof value === "string" && value in conflicts;

/** A conflict an applicant declared, as saved with the application. */
export type DeclaredConflict = { type: ConflictId; detail: string };

// Historical division metadata keeps existing position ids and interview records readable.
// Current recruitment choices come from positionsForUnit below.
export const divisions = {
  executive: {
    label: "Executive Division",
    positions: {
      "ea-chairperson": "Executive Assistant to the Chairperson",
      "ea-vice-chairperson": "Executive Assistant to the Vice Chairperson",
      "ea-secretary-executive": "Executive Assistant to the Secretary to the Executive",
    },
  },
  legal: {
    label: "Legals Division",
    positions: {
      "ea-legal-head": "Executive Assistant to the Legal Head",
      "ea-secretary-adjudicatory": "Executive Assistant to the Secretary to the Adjudicatory",
    },
  },
  operations: {
    label: "Operations Division",
    positions: {
      "ea-deputy-head": "Executive Assistant to the Deputy Head",
      "ea-operations-officer": "Executive Assistant to the Operations Officer",
      "ea-finance-officer": "Executive Assistant to the Finance Officer",
      "ea-logistics-officer": "Executive Assistant to the Logistics Officer",
    },
  },
  "public-information": {
    label: "Public Information Division",
    positions: {
      "ea-public-information-officer": "Executive Assistant to the Public Information Officer",
    },
  },
  central: {
    label: "Central Division",
    positions: {
      "ea-central-representative": "Executive Assistant to the Central Representative",
    },
  },
} as const satisfies Record<string, { label: string; positions: Record<string, string> }>;

export type DivisionId = keyof typeof divisions;

/** Existing ids stay stable so saved slot counts and applications still refer to the same office. */
const existingPositions = Object.values(divisions).flatMap(({ positions }) => Object.entries(positions).map(([id, label]) => ({ id, label })));

const recruitmentPosition = (role: string) => {
  const label = `Executive Assistant to the ${role}`;
  const existing = existingPositions.find((position) => position.label === label);
  return { id: existing?.id ?? `ea-${role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`, label, role };
};

// Reuse saved ids where an office has a unit-specific title, preserving its vacancy count.
const previousOfficeNames: Record<string, Record<string, string>> = {
  "Alfredo M. Velayo College of Accountancy": {
    "Chief Finance Officer": "Finance Officer",
    "Logistics Director": "Logistics Officer",
    "Chief Operations Officer": "Operations Officer",
    "Chief Public Information Officer": "Public Information Officer",
  },
  "Faculty of Pharmacy": {
    "Finance Head": "Finance Officer",
    "Logistics Head": "Logistics Officer",
    "Operations Head": "Operations Officer",
  },
  "College of Science": { "Deputy Head/Chief-of-Staff Officer": "Deputy Head" },
};

/** Recruitment follows each unit's offices, in directory order, without division grouping. */
export function positionsForUnit(college = "") {
  return (college ? (localRolesByCollege[college] ?? []) : centralRoles).map((role) => {
    const position = recruitmentPosition(role);
    const previousRole = previousOfficeNames[college]?.[role];
    return previousRole ? { ...position, id: recruitmentPosition(previousRole).id } : position;
  });
}

/** All current offices, used by recruitment slot coverage tests. */
export const positions = [...new Set([...centralRoles, ...Object.values(localRolesByCollege).flat()])].map(recruitmentPosition);

/** Open slots per position id. */
export type SlotCounts = Record<string, number>;
/** Central uses an empty key; each Local unit uses its college name. */
export type UnitSlotCounts = Record<string, SlotCounts>;
