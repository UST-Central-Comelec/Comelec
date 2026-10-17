"use server";

import { positionIdFor } from "@/lib/applications/options";
import { requireEditor } from "@/lib/auth/session";
import { officeOf } from "@/lib/data/accounts";
import { canEditSection, fixedPositions, programIdFor, readSectionKey, sectionSchema, type CollegeEntry, type CustomRole, type ProgramEntry, type ReferenceData, type SectionKey, type UnitPosition } from "@/lib/reference/data";
import { getReferenceData, writeReferenceSection, type SaveChecks } from "@/lib/reference/store";

export type DatabaseSaveResult =
  | { data: ReferenceData; error?: never; fieldErrors?: never }
  | { data?: never; error: string; fieldErrors?: Record<string, string> };

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * Saves one Database section. `expected` is when the section the editor opened was saved (null if
 * it never was), so a save can't silently replace someone else's.
 */
export async function saveDatabaseSection(section: string, expected: string | null, value: unknown): Promise<DatabaseSaveResult> {
  const user = await requireEditor("database");
  const key = readSectionKey(section);
  if (!key || (expected !== null && typeof expected !== "string")) return { error: "Reload the page and try again." };
  if (!canEditSection(user, section)) return { error: user.kind === "official" ? "Your official account can only change its own unit’s lists." : "Only official accounts can change the Database." };

  const parsed = sectionSchema(key.kind).safeParse(value);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { error: "Check the highlighted entries.", fieldErrors };
  }

  const current = await getReferenceData();
  const unit = "unit" in key ? key.unit : "";
  if ("unit" in key && key.kind !== "programs" && unit && !current.colleges.some((college) => college.name === unit && college.comelec)) return { error: "That unit has no Local Comelec. Reload the page and try again." };
  if (key.kind === "programs" && !current.colleges.some((college) => college.name === unit)) return { error: "That college or faculty isn’t in the Database. Reload the page and try again." };

  const checks: SaveChecks = { unit, renames: [], roles: [], colleges: [], units: [], programRenames: [], programs: [] };
  if (key.kind === "colleges") {
    const next = parsed.data as CollegeEntry[];
    const kept = new Map(next.map((college) => [college.name, college]));
    checks.colleges = current.colleges.filter((college) => !kept.has(college.name)).map((college) => college.name);
    checks.units = current.colleges.filter((college) => college.comelec && kept.get(college.name)?.comelec === false).map((college) => college.name);
  }
  if (key.kind === "programs") {
    const next = parsed.data as ProgramEntry[];
    const before = new Map((current.programs[unit] ?? []).map((program) => [program.id, program]));
    const taken = new Set(next.filter((program) => !program.id.startsWith("new-")).map((program) => program.id));
    for (const program of next) {
      const saved = before.get(program.id);
      if (!saved) {
        // New: an id from its name. Former names only ever come from the server.
        if (program.id.startsWith("new-")) {
          program.id = programIdFor(program.name, new Set([...taken, ...before.keys()]));
          taken.add(program.id);
        }
        program.formerNames = [];
        continue;
      }
      // A rename carries onto the college's accounts and pending requests; the old name is kept so
      // applications and registrations saved under it still read as this program.
      const former = new Set(saved.formerNames);
      if (program.name !== saved.name) {
        checks.programRenames!.push({ from: saved.name, to: program.name });
        former.add(saved.name);
      }
      former.delete(program.name);
      program.formerNames = [...former];
    }
    const kept = new Set(next.map((program) => program.id));
    // Deleting outright is only for a program no account has; otherwise it's retired.
    checks.programs = [...before.values()].filter((program) => !kept.has(program.id)).map((program) => program.name);
  }
  if (key.kind === "positions") {
    const next = parsed.data as UnitPosition[];
    const before = current.positions[unit] ?? [];
    // A new office takes its recruitment position's usual id, so one added back finds its old slots.
    const taken = new Set(next.filter((position) => !position.id.startsWith("new-")).map((position) => position.id));
    for (const position of next) {
      if (!position.id.startsWith("new-")) continue;
      const base = positionIdFor(position.name);
      let id = base;
      for (let count = 2; taken.has(id); count += 1) id = `${base}-${count}`;
      taken.add(id);
      position.id = id;
    }
    const fixed = fixedPositions(unit);
    for (const position of before) {
      const after = next.find((item) => item.id === position.id);
      if (fixed.includes(position.name) && after?.name !== position.name) return { error: `${position.name} can be moved but not renamed or removed: other parts of the portal look for it by name.`, fieldErrors: after ? { [`${next.indexOf(after)}.name`]: "Keep this name." } : {} };
      if (!after) checks.roles.push(position.name, officeOf(position.name));
      else if (after.name !== position.name) checks.renames.push({ from: position.name, to: after.name }, { from: officeOf(position.name), to: officeOf(after.name) });
    }
  }
  if (key.kind === "roles") {
    const next = parsed.data as CustomRole[];
    const board = new Set((current.positions[unit] ?? []).flatMap((position) => [position.name.toLowerCase(), officeOf(position.name).toLowerCase()]));
    const clash = next.findIndex((role) => board.has(role.name.toLowerCase()));
    if (clash !== -1) return { error: "Check the highlighted entries.", fieldErrors: { [`${clash}.name`]: "This unit already has this role or position. Pick another name." } };
    for (const role of current.customRoles[unit] ?? []) {
      const after = next.find((item) => item.id === role.id);
      if (!after || after.position !== role.position) checks.roles.push(role.name);
      else if (after.name !== role.name) checks.renames.push({ from: role.name, to: after.name });
    }
  }

  try {
    const outcome = await writeReferenceSection(section as SectionKey, parsed.data, expected, user.email, checks);
    if ("conflict" in outcome) return { error: "Someone else saved this list while you were editing. Reload the page to see their changes, then make yours again." };
    if ("blocked" in outcome) {
      const reasons = outcome.blocked.map(({ name, count }) => `“${name}” is still used by ${plural(count, "account")}.`);
      if (key.kind === "programs") return { error: `${reasons.join(" ")} Retire it instead: it leaves the forms, and those accounts keep it.` };
      return { error: `${reasons.join(" ")} Change those accounts under Accounts first, or rename it instead of removing it.` };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the Database. Try again." };
  }
  return { data: await getReferenceData() };
}
