import "server-only";

import { defaultPeriod, isPeriodMode, type ApplicationPeriod, type PeriodMode } from "@/lib/applications/period";
import { isVenueMode, type EventDetails } from "@/lib/events/options";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { CENTRAL_UNIT, isPeriodKind, sameUnit, unitFromKey, unitKey, type PeriodKind, type Unit } from "./kinds";

// Reads and saves public.unit_periods (supabase/migrations/0027_unit_periods.sql): one row per unit
// per kind, holding whether that unit's Recruitment, Political Party Registration or Filing of
// Candidacy is open, and the event details it's listed under. Each follows the period rules of
// lib/applications/period.ts. A unit with no row hasn't opened anything: it's closed.

/** A unit's period, with the event details it's listed under while it's open (null until the unit fills them in). */
export type UnitPeriod = ApplicationPeriod & {
  kind: PeriodKind;
  unit: Unit;
  details: EventDetails | null;
  detailsUpdatedAt: string | null;
  detailsUpdatedBy: string | null;
};

const MIGRATION = "supabase/migrations/0027_unit_periods.sql";

/** A unit that has never saved anything. */
const unopened = (kind: PeriodKind, unit: Unit): UnitPeriod => ({ kind, unit, mode: "closed", closesAt: null, graceEndsAt: null, updatedAt: null, updatedBy: null, details: null, detailsUpdatedAt: null, detailsUpdatedBy: null });

/** Postgres hands times back as "13:00:00"; the app works in "13:00". */
const hoursAndMinutes = (time: unknown) => (typeof time === "string" && time ? time.slice(0, 5) : null);

type Row = Record<string, unknown>;

function detailsOf(row: Row): EventDetails | null {
  const startsTime = hoursAndMinutes(row.starts_time);
  const endsTime = hoursAndMinutes(row.ends_time);
  if (!row.details_updated_at || typeof row.name !== "string" || typeof row.event_date !== "string" || !startsTime || !endsTime || !isVenueMode(row.venue_mode)) return null;
  return {
    name: row.name,
    summary: (row.summary as string | null) ?? "",
    background: (row.background as string | null) ?? "",
    eventDate: row.event_date,
    // Before supabase/migrations/0028 a period has one date.
    endDate: typeof row.end_date === "string" ? row.end_date : row.event_date,
    ingressTime: hoursAndMinutes(row.ingress_time),
    startsTime,
    endsTime,
    egressTime: hoursAndMinutes(row.egress_time),
    venueMode: row.venue_mode,
    venueDetails: (row.venue_details as string | null) ?? "",
    openToStudents: row.open_to_students !== false,
    openToExternals: row.open_to_externals === true,
    openToAdmins: row.open_to_admins === true,
  };
}

function toPeriod(kind: PeriodKind, unit: Unit, row: Row): UnitPeriod {
  return {
    kind,
    unit,
    mode: isPeriodMode(row.mode) ? row.mode : "closed",
    closesAt: (row.closes_at as string | null) ?? null,
    graceEndsAt: (row.grace_ends_at as string | null | undefined) ?? null,
    opensAt: (row.opens_at as string | null | undefined) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    details: detailsOf(row),
    detailsUpdatedAt: (row.details_updated_at as string | null | undefined) ?? null,
    detailsUpdatedBy: (row.details_updated_by as string | null | undefined) ?? null,
  };
}

/** True when the table isn't there: 0027 hasn't been run. */
const isMissing = (error: { code?: string; message: string }) => error.code === "PGRST205" || error.code === "42P01" || /could not find the table|does not exist/i.test(error.message);

/**
 * Before 0027 is run: the single settings the commission had (0010 and 0015), which were the
 * Central Comelec's. The website and the portal then stand as they did, and no Local unit has
 * anything open.
 */
async function beforeMigration(): Promise<UnitPeriod[]> {
  const client = createAdminClient();
  const [recruitment, filings] = await Promise.all([client.from("recruitment_settings").select("*").eq("id", true).maybeSingle(), client.from("filing_periods").select("*")]);
  return [
    ...(recruitment.data ? [toPeriod("recruitment", CENTRAL_UNIT, recruitment.data)] : []),
    ...(filings.data ?? []).filter((row) => isPeriodKind(row.kind)).map((row) => toPeriod(row.kind as PeriodKind, CENTRAL_UNIT, row)),
  ];
}

/** Every unit's saved period, of one kind or of all three. Units that never saved one aren't in it. */
export async function listUnitPeriods(kind?: PeriodKind): Promise<UnitPeriod[]> {
  // Without a database the site still shows the Apply form, as it did before this setting existed.
  if (!isSupabaseConfigured()) return !kind || kind === "recruitment" ? [{ ...unopened("recruitment", CENTRAL_UNIT), ...defaultPeriod }] : [];

  let query = createAdminClient().from("unit_periods").select("*");
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error && isMissing(error)) return (await beforeMigration()).filter((period) => !kind || period.kind === kind);
  if (error) throw new Error(`Couldn’t load the settings: ${error.message}`);
  return data.filter((row) => isPeriodKind(row.kind)).map((row) => toPeriod(row.kind as PeriodKind, unitFromKey((row.college as string | null) ?? ""), row));
}

/** One unit's period. Closed, with no details, when the unit has never saved one. */
export async function getUnitPeriod(kind: PeriodKind, unit: Unit): Promise<UnitPeriod> {
  return (await listUnitPeriods(kind)).find((period) => sameUnit(period.unit, unit)) ?? unopened(kind, unit);
}

async function save(kind: PeriodKind, unit: Unit, values: Row) {
  const { error } = await createAdminClient()
    .from("unit_periods")
    .upsert({ kind, college: unitKey(unit), ...values }, { onConflict: "kind,college" });
  if (error && isMissing(error)) throw new Error(`Each unit’s settings aren’t set up in the database yet. Run ${MIGRATION} in the Supabase SQL Editor, then save again.`);
  if (error) throw new Error(`Couldn’t save: ${error.message}`);
}

export type PeriodChange = { mode: PeriodMode; opensAt?: string | null; closesAt: string | null; graceEndsAt: string | null };

/** Schedules or closes a unit's period, and with `details` saves the event details it's listed under too. */
export async function saveUnitPeriod(kind: PeriodKind, unit: Unit, period: PeriodChange, author: string, details?: EventDetails) {
  const values: Row = { mode: period.mode, closes_at: period.closesAt, grace_ends_at: period.graceEndsAt, updated_at: new Date().toISOString(), updated_by: author };
  if (period.opensAt !== undefined) values.opens_at = period.opensAt;
  try {
    await save(kind, unit, details ? { ...values, ...detailValues(details, author) } : values);
  } catch (error) {
    if (error instanceof Error && /opens_at|end_date/.test(error.message)) throw new Error("Each unit’s dates aren’t set up in the database yet. Run supabase/migrations/0028_event_end_dates.sql in the Supabase SQL Editor, then save again.");
    throw error;
  }
}

const detailValues = (details: EventDetails, author: string): Row => ({
  name: details.name,
  summary: details.summary,
  background: details.background,
  event_date: details.eventDate,
  end_date: details.endDate,
  ingress_time: details.ingressTime,
  starts_time: details.startsTime,
  ends_time: details.endsTime,
  egress_time: details.egressTime,
  venue_mode: details.venueMode,
  venue_details: details.venueDetails,
  open_to_students: details.openToStudents,
  open_to_externals: details.openToExternals,
  open_to_admins: details.openToAdmins,
  details_updated_at: new Date().toISOString(),
  details_updated_by: author,
});

/** For the website: periods that can't be read count as closed rather than breaking the page. */
export const listUnitPeriodsForSite = (kind?: PeriodKind) =>
  listUnitPeriods(kind).catch((error) => {
    console.error(error);
    return [] as UnitPeriod[];
  });
