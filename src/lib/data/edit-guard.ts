import "server-only";

import { createHash } from "node:crypto";
import { OVERWRITE_FIELD, STAMP_FIELD, type EditConflict } from "@/lib/portal/edit-conflict";
import type { FormState } from "@/lib/portal/form";
import { toSummary } from "./accounts";
import { store, type Collection, type Item } from "./store";

// Two people editing the same record. Nobody works on it live together: each browser holds its own
// copy and Save sends the whole form. So an edit page stamps the form with the version it opened
// and a fingerprint of each field as it was then (`stampFor`), and a save goes through only over
// that version (`saveGuarded`). When someone else saved in between, the fingerprints tell who
// changed what: changes to different fields are merged, and only the same field changed by both is
// a conflict, which the form shows with a choice (src/components/portal/edit-guard.tsx).

type Values = Record<string, unknown>;
type Stamp = { version: string; fields: Record<string, string> };
export type Guard = { stamp: Stamp | null; overwrite: string | null };

/** The same value however it was read: "", null and a missing key are one, and object keys are ordered. */
function canonical(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") {
    const entries = Object.keys(value).sort().map((key) => [key, canonical((value as Values)[key])] as const);
    return Object.fromEntries(entries.filter(([, item]) => item !== null));
  }
  return value;
}

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("base64url").slice(0, 16);

const bookkeeping = new Set(["id", "createdAt", "updatedAt", "updatedBy"]);

/** The hidden field an edit page gives its form: the version it opened, and each field as it was. */
export function stampFor(version: string, values: Values): string {
  const fields = Object.fromEntries(Object.keys(values).filter((key) => !bookkeeping.has(key)).map((key) => [key, fingerprint(values[key])]));
  return JSON.stringify({ version, fields });
}

/** What the form sent back. A form without a stamp saves as it always has: over whatever is there. */
export function readGuard(formData: FormData): Guard {
  const overwrite = formData.get(OVERWRITE_FIELD);
  let stamp: Stamp | null = null;
  try {
    const sent = JSON.parse(String(formData.get(STAMP_FIELD) ?? "null")) as unknown;
    if (sent && typeof sent === "object" && typeof (sent as Stamp).version === "string" && (sent as Stamp).fields && typeof (sent as Stamp).fields === "object") stamp = sent as Stamp;
  } catch {
    // Left null: saved without the check.
  }
  return { stamp, overwrite: typeof overwrite === "string" && overwrite ? overwrite : null };
}

/**
 * Who changed what since the form was opened. `write` is what this save should still write, `clash`
 * what both changed differently, `theirs` everything the other save changed. Each of `groups` is
 * treated as one field: values that only make sense together, like a table's columns and rows.
 */
export function mergePlan(base: Record<string, string>, submitted: Values, current: Values, groups: readonly (readonly string[])[] = []) {
  const write: string[] = [];
  const clash: string[] = [];
  const theirs: string[] = [];
  const seen = new Set<string>();
  for (const key of Object.keys(submitted)) {
    if (seen.has(key)) continue;
    const unit = groups.find((group) => group.includes(key))?.filter((item) => item in submitted) ?? [key];
    unit.forEach((item) => seen.add(item));
    // Not on the form when it was opened: this save always sets it.
    if (unit.some((item) => !(item in base))) { write.push(...unit); continue; }
    const was = unit.map((item) => base[item]).join();
    const mine = unit.map((item) => fingerprint(submitted[item])).join();
    const now = unit.map((item) => fingerprint(current[item])).join();
    if (now !== was) theirs.push(...unit);
    if (mine === was) continue;
    if (now !== was && mine !== now) clash.push(...unit);
    else write.push(...unit);
  }
  return { write, clash, theirs };
}

type Conflict = Omit<EditConflict, "fields"> & { fields: string[] };
export type GuardedSave<C extends Collection> = { saved: Item<C>; merged: boolean } | { conflict: Conflict } | { missing: true };

type Options = {
  /** The record as the edit page read it, to compare with the stamp. */
  load: () => Promise<object | null>;
  /** False: any field the other save changed is a conflict, for records whose fields are checked together. */
  merge?: boolean;
  groups?: readonly (readonly string[])[];
  /** Whether the merged record still holds together; when not, it's a conflict. */
  check?: (merged: Values) => boolean;
};

/**
 * Saves `data` over the version the form opened. When someone saved in between, saves only what
 * this person changed, as long as the other save didn't change it too. Tried a few times, should
 * saves keep landing at the same moment.
 */
export async function saveGuarded<C extends Collection>(collection: C, id: string, data: Partial<Item<C>>, author: string, guard: Guard, options: Options): Promise<GuardedSave<C>> {
  if (!guard.stamp && !guard.overwrite) {
    const saved = await store.update(collection, id, data, author);
    return saved ? { saved, merged: false } : { missing: true };
  }

  let expected = guard.overwrite ?? guard.stamp!.version;
  let payload: Values = data;
  let merged = false;
  let last: Conflict | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const saved = await store.updateIf(collection, id, payload as Partial<Item<C>>, author, expected);
    if (saved) return { saved, merged };

    const current = (await options.load()) as Values | null;
    if (!current) return { missing: true };
    const version = String(current.updatedAt);
    last = { by: String(current.updatedBy ?? ""), at: version, version, fields: [] };
    // Chose to save over theirs, and someone saved yet again: ask again.
    if (guard.overwrite || !guard.stamp) return { conflict: last };

    const plan = mergePlan(guard.stamp.fields, data, current, options.groups);
    if (options.merge === false) {
      if (plan.theirs.length) return { conflict: { ...last, fields: plan.theirs } };
      payload = data;
    } else {
      if (plan.clash.length) return { conflict: { ...last, fields: plan.clash } };
      payload = Object.fromEntries(plan.write.map((key) => [key, (data as Values)[key]]));
      if (options.check && !options.check({ ...current, ...payload })) return { conflict: { ...last, fields: plan.theirs } };
      merged = plan.theirs.length > 0;
    }
    expected = version;
  }
  return { conflict: last! };
}

/**
 * The form's answer to a conflict: a pop-up, and the choice beside the form. `labels` names fields
 * as the form shows them; `what` is the record, as in "saved this event".
 */
export async function conflictState(conflict: Conflict, labels: Record<string, string>, what: string, you: string): Promise<FormState> {
  const fields = [...new Set(conflict.fields.map((key) => labels[key]).filter(Boolean))];
  const mine = conflict.by.trim().toLowerCase() === you.trim().toLowerCase();
  let by = mine ? "You" : conflict.by || "Someone";
  if (!mine && conflict.by) {
    try {
      const account = (await store.list("accounts")).find((row) => row.email.trim().toLowerCase() === conflict.by.trim().toLowerCase());
      if (account) by = toSummary(account).name || by;
    } catch {
      // Shown by email instead.
    }
  }
  const error = mine
    ? `You saved this ${what} in another tab while editing here, so this wasn’t saved. Choose which version to keep.`
    : `${by} saved this ${what} while you were editing, so yours wasn’t saved. Choose which version to keep.`;
  return { error, conflict: { by, at: conflict.at, version: conflict.version, fields } };
}
