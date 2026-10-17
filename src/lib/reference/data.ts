// Administrative → Database: the lists the forms, dropdowns, recruitment and accounts read.
//
//   Colleges & Faculties  every academic unit, its short names, and whether it has a Local Comelec
//   Programs & Majors     each college's degree programs (strands for Senior High), each with an id
//                         so a rename carries onto the accounts that have it, and retired rather
//                         than deleted while anyone still has it
//   Admin Offices         the university offices letters go to
//   Positions     each unit's Executive Board offices, in rank order (Chairperson, …)
//   Roles         the names of the five roles every account can hold, and the roles each unit
//                         adds for its own accounts (each opening the same tabs as Executive
//                         Associate or Deputy)
//
// Each is saved as its own section in public.reference_data (supabase/migrations/
// 20261015120000_reference_data.sql), so a Local unit saving its own positions never collides with
// the Central Comelec saving the colleges. A section not saved yet keeps its default: the lists
// written in the code (src/lib/applications/options.ts, src/lib/data/local-roles.ts,
// src/lib/data/types.ts, src/lib/letters/offices.ts).
//
// applyReferenceData puts the saved lists into those modules' own arrays and objects, in place.
// The server does it on every request (ensureReferenceData in ./store.ts); browsers do it from the
// root layouts (src/components/reference-data.tsx). Everything that imports the lists sees the
// saved ones without loading them itself.
//
// Free of server-only imports: the editors check what the server checks.

import { z } from "zod";
import { academicUnits, collegeSearchAliases, colleges, notifyReferenceChange, positionIdFor, replaceArray, replaceRecord, programsByCollege, formerProgramNames, retiredProgramsByCollege, unitAbbreviations, unitPositions, type UnitPosition } from "@/lib/applications/options";
import { customRolesByUnit, localRolesByCollege, type CustomRole } from "@/lib/data/local-roles";
import { CENTRAL_REPRESENTATIVE, CHAIRPERSON, DEPUTY, accountPositions, centralRoles, localRoles, type AccountAffiliation, type AccountKind, type AccountPosition } from "@/lib/data/types";
import { universityOffices } from "@/lib/letters/offices";

export type { CustomRole, UnitPosition };

export type CollegeEntry = {
  name: string;
  /** What lists show in place of the name: "CICS". */
  abbreviation: string;
  /** Other short names it goes by, for search and letter destinations: "SCI". */
  aliases: string[];
  /** Whether it has a Local Comelec: students pick it, it has its own positions and accounts. */
  comelec: boolean;
};

/**
 * A college's program. The id stays the same through renames, so a rename can carry onto accounts.
 * A retired program leaves the pickers, but whoever already has it keeps it. `formerNames` are what
 * it was called before, so records saved under an old name are still read as this program.
 */
export type ProgramEntry = { id: string; name: string; retired: boolean; formerNames: string[] };

export type ReferenceData = {
  colleges: CollegeEntry[];
  /** By college name, in the order the pickers offer them. */
  programs: Record<string, ProgramEntry[]>;
  offices: string[];
  /** By unit: "" is the Central Comelec, a Local unit its college's name. */
  positions: Record<string, UnitPosition[]>;
  roleNames: Record<AccountPosition, string>;
  /** By unit, as positions are. */
  customRoles: Record<string, CustomRole[]>;
  /** When each saved section was last saved, so a save can't silently replace someone else's. */
  stamps: Record<string, string>;
};

/** A saved section's key: "colleges", "offices", "role-names", or a unit's "programs:…", "positions:…", "roles:…". */
export type SectionKey = "colleges" | "offices" | "role-names" | `programs:${string}` | `positions:${string}` | `roles:${string}`;

export const sectionKey = {
  programs: (college: string) => `programs:${college}` as const,
  positions: (unit: string) => `positions:${unit}` as const,
  roles: (unit: string) => `roles:${unit}` as const,
};

/** The section's kind and, for a unit's section, the unit. */
export function readSectionKey(key: string): { kind: "colleges" | "offices" | "role-names" } | { kind: "programs" | "positions" | "roles"; unit: string } | null {
  if (key === "colleges" || key === "offices" || key === "role-names") return { kind: key };
  const match = /^(programs|positions|roles):(.*)$/.exec(key);
  return match ? { kind: match[1] as "programs" | "positions" | "roles", unit: match[2] } : null;
}

const clone = <Value,>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "program";

/** A new program's id, from its name, unlike any in `taken`. */
export function programIdFor(name: string, taken: ReadonlySet<string>) {
  const base = `p-${slug(name)}`;
  let id = base;
  for (let count = 2; taken.has(id); count += 1) id = `${base}-${count}`;
  return id;
}

/** Program entries from plain names: the defaults, and any list saved before programs had ids. */
const programEntries = (names: readonly string[]): ProgramEntry[] => {
  const taken = new Set<string>();
  return names.map((name) => {
    const id = programIdFor(name, taken);
    taken.add(id);
    return { id, name, retired: false, formerNames: [] };
  });
};
const byName = (a: string, b: string) => a.localeCompare(b);

/** A new unit's offices: the Executive Board every Local Comelec starts with. */
const startingPositions = (unit: string): UnitPosition[] => (unit ? localRoles : centralRoles).map((name) => ({ id: positionIdFor(name), name }));

// Taken when this module loads, before anything is applied: the lists as the code writes them.
const defaults: ReferenceData = clone({
  colleges: [...academicUnits].sort(byName).map((name) => ({ name, abbreviation: unitAbbreviations[name] ?? "", aliases: collegeSearchAliases[name] ?? [], comelec: colleges.includes(name) })),
  programs: Object.fromEntries(Object.entries(programsByCollege).map(([college, names]) => [college, programEntries(names)])),
  offices: universityOffices,
  positions: unitPositions,
  roleNames: accountPositions,
  customRoles: {},
  stamps: {},
});

export const defaultReferenceData = (): ReferenceData => clone(defaults);

/** The lists with the saved sections in place of their defaults. */
export function composeReferenceData(sections: ReadonlyArray<{ section: string; value: unknown; updatedAt: string }>): ReferenceData {
  const data = defaultReferenceData();
  for (const { section, value, updatedAt } of sections) {
    const key = readSectionKey(section);
    if (!key) continue;
    const parsed = sectionSchema(key.kind).safeParse(value);
    if (!parsed.success) continue;
    data.stamps[section] = updatedAt;
    if ("unit" in key) {
      if (key.kind === "programs") data.programs[key.unit] = parsed.data as ProgramEntry[];
      else if (key.kind === "positions") data.positions[key.unit] = parsed.data as UnitPosition[];
      else data.customRoles[key.unit] = parsed.data as CustomRole[];
    } else if (key.kind === "colleges") data.colleges = parsed.data as CollegeEntry[];
    else if (key.kind === "offices") data.offices = parsed.data as string[];
    else data.roleNames = parsed.data as Record<AccountPosition, string>;
  }
  // Every Local Comelec has offices, a new one starting with the usual Executive Board.
  for (const college of data.colleges) if (college.comelec && !data.positions[college.name]) data.positions[college.name] = startingPositions(college.name);
  return data;
}

let applied = "";

/** Puts the lists into the modules everything reads them from. Cheap when nothing changed. */
export function applyReferenceData(data: ReferenceData) {
  const signature = JSON.stringify(data.stamps);
  if (signature === applied) return;
  applied = signature;
  const all = [...data.colleges].sort((a, b) => byName(a.name, b.name));
  const units = all.filter((college) => college.comelec).map((college) => college.name);
  const programs = (college: string) => data.programs[college] ?? [];
  replaceRecord(programsByCollege, Object.fromEntries(all.map((college) => [college.name, programs(college.name).filter((program) => !program.retired).map((program) => program.name)])));
  replaceRecord(retiredProgramsByCollege, Object.fromEntries(all.map((college) => [college.name, programs(college.name).filter((program) => program.retired).map((program) => program.name)])));
  // A former name another program has taken since stays that program's.
  replaceRecord(formerProgramNames, Object.fromEntries(all.map((college) => {
    const current = new Set(programs(college.name).map((program) => program.name));
    return [college.name, Object.fromEntries(programs(college.name).flatMap((program) => program.formerNames.filter((former) => !current.has(former)).map((former) => [former, program.name])))];
  })));
  replaceArray(colleges, units);
  replaceArray(academicUnits, all.map((college) => college.name));
  replaceRecord(unitAbbreviations, Object.fromEntries(all.filter((college) => college.abbreviation).map((college) => [college.name, college.abbreviation])));
  replaceRecord(collegeSearchAliases, Object.fromEntries(all.filter((college) => college.aliases.length).map((college) => [college.name, [...college.aliases]])));
  const positions = Object.fromEntries(["", ...units].map((unit) => [unit, clone(data.positions[unit] ?? startingPositions(unit))]));
  replaceRecord(unitPositions, positions);
  replaceArray(centralRoles, positions[""].map((position) => position.name));
  replaceRecord(localRolesByCollege, Object.fromEntries(units.map((unit) => [unit, positions[unit].map((position) => position.name)])));
  Object.assign(accountPositions, data.roleNames);
  replaceRecord(customRolesByUnit, clone(data.customRoles));
  replaceArray(universityOffices, data.offices);
  notifyReferenceChange();
}

/**
 * Offices other features find by name, so they can be moved but not renamed or removed: the
 * Chairperson everywhere; a Local unit's Central Representative (En Banc); and the Central
 * officers who write and sign the Constitution and Elections Code (src/lib/codes/options.ts).
 */
export const fixedPositions = (unit: string): readonly string[] => (unit
  ? [CHAIRPERSON, CENTRAL_REPRESENTATIVE]
  : [CHAIRPERSON, "Vice Chairperson", "Secretary to the Executive", "Legal Head", "Secretary to the Adjudicatory"]);

/** Who can change the Database: official accounts only, and a Local one only its own unit's lists. */
type Editor = { kind: AccountKind; affiliation: AccountAffiliation; college: string | null; readOnly: boolean };

export const editsDatabase = (user: Editor) => user.kind === "official" && !user.readOnly;

export function canEditSection(user: Editor, section: string) {
  if (!editsDatabase(user)) return false;
  if (user.affiliation === "central") return true;
  const key = readSectionKey(section);
  return user.affiliation === "local" && Boolean(user.college) && key !== null && "unit" in key && key.unit === user.college;
}

/** Collapses runs of spaces and trims both ends, so pasted names don't carry stray spaces. */
export const cleanName = (value: string) => value.replace(/\s+/g, " ").trim();

const text = (noun: string, max: number) => z.string().transform(cleanName).pipe(z.string().min(1, `Enter the ${noun}.`).max(max, `Keep the ${noun} within ${max} characters.`));
const id = z.string().regex(/^[\w-]{1,140}$/, "Unknown item.");

/** Adds an error under each name that repeats an earlier one, ignoring case. */
function unique<Item>(items: readonly Item[], context: z.RefinementCtx, nameOf: (item: Item) => string, noun: string, field?: string) {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const key = nameOf(item).toLowerCase();
    if (key && seen.has(key)) context.addIssue({ code: "custom", path: field ? [index, field] : [index], message: `This ${noun} is already listed.` });
    seen.add(key);
  });
}

const collegeSchema = z.object({
  name: text("college or faculty name", 120),
  abbreviation: z.string().transform(cleanName).pipe(z.string().max(20, "Keep the abbreviation within 20 characters.")),
  aliases: z.array(z.string().transform(cleanName).pipe(z.string().min(1).max(30, "Keep each other name within 30 characters."))).max(10, "Keep up to 10 other names."),
  comelec: z.boolean(),
});

export const collegesSchema = z.array(collegeSchema).min(1, "Keep at least one college or faculty.").max(80, "Keep up to 80 colleges and faculties.").superRefine((items, context) => {
  unique(items, context, (item) => item.name, "college or faculty", "name");
  unique(items, context, (item) => item.abbreviation, "abbreviation", "abbreviation");
});

const namesSchema = (noun: string, max: number, limit: number) => z.array(text(`${noun} name`, max)).max(limit, `Keep up to ${limit} items.`).superRefine((items, context) => unique(items, context, (item) => item, noun));

const programSchema = z.object({
  id,
  name: text("program name", 200),
  retired: z.boolean().default(false),
  formerNames: z.array(z.string().max(200)).max(50).default([]),
});

/** A college's programs. Lists saved as plain names (before programs had ids) are read as entries. */
export const programsSchema = z.preprocess(
  (value) => (Array.isArray(value) && value.every((item) => typeof item === "string") ? programEntries(value as string[]) : value),
  z.array(programSchema).max(300, "Keep up to 300 programs.").superRefine((items, context) => {
    unique(items, context, (item) => item.name, "program", "name");
    unique(items, context, (item) => item.id, "program", "name");
  }),
);
export const officesSchema = namesSchema("office", 300, 500).pipe(z.array(z.string()).min(1, "Keep at least one office."));

export const positionsSchema = z.array(z.object({ id, name: text("position name", 100) })).min(1, "Keep at least one position.").max(40, "Keep up to 40 positions.").superRefine((items, context) => {
  unique(items, context, (item) => item.name, "position", "name");
  unique(items, context, (item) => item.id, "position", "name");
});

export const roleNamesSchema = z.object(Object.fromEntries(Object.keys(defaults.roleNames).map((key) => [key, text("role name", 40)])) as Record<AccountPosition, ReturnType<typeof text>>)
  .superRefine((names, context) => {
    const seen = new Set<string>();
    for (const [key, name] of Object.entries(names)) {
      if (seen.has(name.toLowerCase())) context.addIssue({ code: "custom", path: [key], message: "Another role already has this name." });
      seen.add(name.toLowerCase());
    }
  });

export const customRolesSchema = z.array(z.object({ id, name: text("role name", 100), position: z.enum(["executive-associate", "deputy"]) })).max(40, "Keep up to 40 roles.").superRefine((items, context) => {
  unique(items, context, (item) => item.name, "role", "name");
  items.forEach((item, index) => {
    if (item.name.toLowerCase() === DEPUTY.toLowerCase() || /^office of the /i.test(item.name)) context.addIssue({ code: "custom", path: [index, "name"], message: "Every unit already has this role. Pick another name." });
  });
});

export function sectionSchema(kind: "colleges" | "offices" | "role-names" | "programs" | "positions" | "roles"): z.ZodType {
  return { colleges: collegesSchema, offices: officesSchema, "role-names": roleNamesSchema, programs: programsSchema, positions: positionsSchema, roles: customRolesSchema }[kind];
}

/** What the editors call each list, and how many there are, for messages. */
export const sectionLabels = { colleges: "Colleges & Faculties", programs: "Programs & Majors", offices: "Admin Offices", positions: "Positions", roles: "Roles", "role-names": "Roles" } as const;
