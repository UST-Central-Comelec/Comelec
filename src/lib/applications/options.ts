import { accountPositions, centralRoles } from "@/lib/data/types";
import { customRolesByUnit, localRolesByCollege } from "@/lib/data/local-roles";

// Choices shown on the commissioner application form.
// Colleges and programs come from ust.edu.ph (Faculties, Colleges, Institutes, and Schools, and
// each college's own page), undergraduate and first professional degrees only, as of September 2026.
// The database checks year level and preferred body (supabase/migrations/0004_applications.sql),
// so keep those keys in sync.
//
// These are the defaults. Administrative → Database edits them, and saving there replaces the
// contents of these lists in place (src/lib/reference/data.ts), so read them where they're used
// rather than copying them into a constant when a module loads.

// ——— Keeping the lists live ———
// The lists edited under Administrative → Database (colleges, programs, offices, positions, roles)
// are plain arrays and objects read synchronously across the app. Saving there replaces their
// contents in place (applyReferenceData in src/lib/reference/data.ts), so every import sees the
// saved lists. Lists built from them elsewhere rebuild themselves through onReferenceChange. These
// helpers live here, beside the lists, because every module that needs them already imports this one.

/** Replaces an array's items, keeping the array itself (and so every import of it). */
export function replaceArray<Item>(target: Item[], next: readonly Item[]) {
  target.splice(0, target.length, ...next);
}

/** Replaces an object's entries, keeping the object itself. */
export function replaceRecord<Value>(target: Record<string, Value>, next: Readonly<Record<string, Value>>) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, next);
}

const listeners = new Set<() => void>();

/** Runs `rebuild` now and after every change, for a list made from the Database's lists. */
export function onReferenceChange(rebuild: () => void) {
  listeners.add(rebuild);
  rebuild();
}

export function notifyReferenceChange() {
  for (const rebuild of listeners) rebuild();
}

const bs = (name: string) => `Bachelor of Science in ${name}`;
const ab = (name: string) => `Bachelor of Arts in ${name}`;
const performance = (instrument: string) => `Bachelor of Music in Performance, major in ${instrument}`;

export const programsByCollege: Record<string, string[]> = {
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
};

/**
 * Programs a college no longer offers (retired under Administrative → Database). New entries can't
 * pick them, but people who already have one keep it, and their accounts still save with it.
 */
export const retiredProgramsByCollege: Record<string, string[]> = {};

/** Names programs had before they were renamed, by college, each to the program's current name. */
export const formerProgramNames: Record<string, Record<string, string>> = {};

/** A program as it's called now: records saved before a rename keep the old name. */
export const currentProgramName = (college: string | null | undefined, program: string) => (college ? formerProgramNames[college]?.[program] : undefined) ?? program;

/** A college or faculty's name. Kept as an alias of string for the many places that name it. */
export type College = string;

/** Colleges and faculties with a Local Comelec, including the three high schools: what students pick from. */
export const colleges: string[] = Object.keys(programsByCollege).sort((a, b) => a.localeCompare(b));

/** Every academic unit with a Local Comelec, including the three high schools. The same list as `colleges`. */
export const comelecUnits: readonly string[] = colleges;

/** Every academic unit, with or without a Local Comelec: event organizers and letter destinations. */
export const academicUnits: string[] = [...colleges, "Graduate School", "Graduate School of Law", "Institute of Religion"].sort((a, b) => a.localeCompare(b));

/** Each unit's short name, as the commission writes it: what lists show in place of the full name. */
export const unitAbbreviations: Record<string, string> = {
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
  "Graduate School": "GS",
  "Graduate School of Law": "GSL",
  "Institute of Religion": "IR",
};

/** Other short names a unit goes by: searched, and listed after the abbreviation in letter destinations. */
export const collegeSearchAliases: Record<string, string[]> = {
  "College of Architecture": ["ARKI"],
  "Faculty of Civil Law": ["CIVIL LAW", "LAW"],
  "College of Commerce and Business Administration": ["COMMERCE", "COM"],
  "Faculty of Engineering": ["ENGG"],
  "Faculty of Medicine and Surgery": ["MED"],
  "Conservatory of Music": ["MUS"],
  "College of Nursing": ["NUR"],
  "Faculty of Pharmacy": ["FOP", "PHA"],
  "Faculty of Sacred Theology": ["THEO"],
  "College of Science": ["SCI"],
  "Graduate School of Law": ["GS Law"],
};

/** Search aliases stay internal; choices and saved answers keep their full names. */
export function filterCollegeOptions(options: readonly string[], query: string): readonly string[] {
  const search = query.trim().toLowerCase();
  return options.filter(option => option.toLowerCase().includes(search)
    || Boolean(unitAbbreviations[option]?.toLowerCase().includes(search))
    || Boolean(collegeSearchAliases[option]?.some(alias => alias.toLowerCase().includes(search))));
}


/**
 * Applications are deleted this many days after they're submitted (the nightly job in
 * supabase/migrations/0007_application_retention.sql); the site hides them from that moment.
 */
export const APPLICATION_RETENTION_DAYS = 60;

/** The oldest submission time still kept, as an ISO string for queries. */
export const retentionCutoff = (now = Date.now()) => new Date(now - APPLICATION_RETENTION_DAYS * 86_400_000).toISOString();

const collegeYearLevels = { "1": "1st year", "2": "2nd year", "3": "3rd year", "4": "4th year", swis: "SWIS" } as const;
const architectureYearLevels = { ...collegeYearLevels, "5": "5th year" } as const;
const juniorGrades = { "7": "Grade 7", "8": "Grade 8", "9": "Grade 9", "10": "Grade 10" } as const;
const seniorGrades = { "11": "Grade 11", "12": "Grade 12" } as const;
/** All stored levels, for display; forms use yearLevelsFor for the selected school. */
export const yearLevels = { ...architectureYearLevels, ...juniorGrades, ...seniorGrades } as const;

/** A school whose students have no program to pick (EHS and JHS): a known college with an empty program list. */
export const programLocked = (college: string | null | undefined) => Boolean(college) && Object.hasOwn(programsByCollege, college!) && programsByCollege[college!].length === 0;

export function yearLevelsFor(college: string | null | undefined): Readonly<Record<string, string>> {
  return college === "Junior High School" ? juniorGrades : college === "Senior High School" ? seniorGrades : college === "College of Architecture" ? architectureYearLevels : collegeYearLevels;
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

/** An Executive Board office in a unit, and the id its recruitment slots and applications are saved under. */
export type UnitPosition = { id: string; name: string };

/** The id a new office gets: its recruitment position's, so an office added back finds its old slots. */
export const positionIdFor = (name: string) => recruitmentPosition(name).id;

/**
 * Each unit's Executive Board offices in rank order. "" is the Central Comelec; a Local unit is its
 * college's name. Ids stay the same when an office is renamed, so its slots and applicants follow it.
 */
export const unitPositions: Record<string, UnitPosition[]> = Object.fromEntries(["", ...Object.keys(localRolesByCollege)].map((unit) => [
  unit,
  (unit ? localRolesByCollege[unit] : centralRoles).map((name) => ({ id: positionIdFor(previousOfficeNames[unit]?.[name] ?? name), name })),
]));

/** Which role in an office a recruitment opening is for. */
export type OpeningKind = "board" | "associate" | "added";

/**
 * One role in one office that recruitment can open: the office's Executive Board seat, an Executive
 * Associate in it, or a role the unit added under Administrative → Database → Roles.
 * `position` and `role` are what the account gets when the applicant is onboarded.
 */
export type RecruitmentOpening = {
  id: string;
  label: string;
  officeId: string;
  office: string;
  kind: OpeningKind;
  roleName: string;
  position: "executive-board" | "executive-associate" | "deputy";
  role: string;
};

/**
 * The id an opening's slots and applications are saved under. An Executive Associate keeps the
 * office's own id, which is what every opening was before roles were split out, so older counts and
 * applications still refer to it. The board seat and added roles add a suffix.
 */
export const openingId = (officeId: string, kind: OpeningKind, addedId = "") => (kind === "associate" ? officeId : `${officeId}:${kind === "board" ? "board" : addedId}`);

/** The roles a unit recruits into each office: the board seat, Executive Associates, then its added roles. */
export function recruitRolesFor(college = "") {
  // The Central Comelec has no Deputies, so a Central role based on Deputy can't be recruited.
  const added = (customRolesByUnit[college] ?? []).filter((role) => role.name.trim() && (college || role.position !== "deputy"));
  return [
    { kind: "board" as const, id: "board", name: accountPositions["executive-board"] },
    { kind: "associate" as const, id: "associate", name: accountPositions["executive-associate"] },
    ...added.map((role) => ({ kind: "added" as const, id: role.id, name: role.name, position: role.position })),
  ];
}

/**
 * Every opening in a unit ("" is the Central Comelec), office by office in rank order. Labels name
 * the role, then the office: "Executive Associate to the Chairperson". A board seat is the office
 * itself: "Chairperson".
 */
export function openingsForUnit(college = ""): RecruitmentOpening[] {
  const roles = recruitRolesFor(college);
  return (unitPositions[college] ?? []).flatMap(({ id: officeId, name: office }) => roles.map((role): RecruitmentOpening => {
    const base = { officeId, office, kind: role.kind, roleName: role.name, id: openingId(officeId, role.kind, role.id) };
    if (role.kind === "board") return { ...base, label: office, position: "executive-board", role: office };
    if (role.kind === "associate") return { ...base, label: `${role.name} to the ${office}`, position: "executive-associate", role: `Office of the ${office}` };
    return { ...base, label: `${role.name} to the ${office}`, position: role.position, role: role.name };
  }));
}

/** The openings an applicant can pick from, and every screen names an application's position by. */
export const positionsForUnit = openingsForUnit;

/**
 * The position an application or interview booking is for, as its unit's office is called now.
 * Applications save the label they were sent with, so an office renamed under Administrative →
 * Database is looked up by its id; one no longer in the unit keeps its saved label.
 */
export function currentPositionLabel(body: string | null | undefined, college: string | null | undefined, positionId: string | null | undefined, saved: string) {
  if (!positionId) return saved;
  return positionsForUnit(body === "local" ? college ?? "" : "").find((position) => position.id === positionId)?.label ?? saved;
}

/** All current offices, used by recruitment slot coverage tests. */
export const positions: Array<{ id: string; label: string; role: string }> = [];
onReferenceChange(() => replaceArray(positions, [...new Map(Object.keys(unitPositions).flatMap((unit) => positionsForUnit(unit)).map((position) => [position.id, position])).values()]));

/** Open slots per position id. */
export type SlotCounts = Record<string, number>;
/** Central uses an empty key; each Local unit uses its college name. */
export type UnitSlotCounts = Record<string, SlotCounts>;
