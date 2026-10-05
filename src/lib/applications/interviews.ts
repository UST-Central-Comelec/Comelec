import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import type { InterviewMode, InterviewSlot } from "./interview-format";
import { applicantName, isMiddleNameColumnMissing } from "./name";
import { divisions, yearLevels, type DivisionId } from "./options";

// Interview slots, stored in public.interview_slots (supabase/migrations/0006_interview_slots.sql).

export type SlotBooking = {
  id: string; name: string; referenceCode: string; position: string;
  lastName: string; firstName: string; middleName: string;
  email: string; facebookUrl: string; college: string; program: string; yearLevel: string;
};
export type AdminInterviewSlot = InterviewSlot & { createdBy: string; bookings: SlotBooking[] };

type Row = Record<string, unknown>;

const isDivision = (value: unknown): value is DivisionId => typeof value === "string" && value in divisions;

const toSlot = (row: Row, booked: number): InterviewSlot => ({
  id: row.id as string,
  college: (row.college as string) ?? "",
  division: isDivision(row.division) ? row.division : null,
  startsAt: row.starts_at as string,
  durationMinutes: row.duration_minutes as number,
  mode: row.mode as InterviewMode,
  location: (row.location as string | null) || null,
  capacity: row.capacity as number,
  booked,
});

/** Upcoming slots that still have room, for the apply form. */
export async function getOpenSlots(): Promise<InterviewSlot[]> {
  if (!isSupabaseConfigured()) return [];
  // One round trip: each slot comes with its booking count (via applications.interview_slot_id).
  const { data, error } = await createAdminClient()
    .from("interview_slots")
    .select("*, applications(count)")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw new Error(`Couldn’t load interview slots: ${error.message}`);
  return data
    .map((slot) => toSlot(slot, (slot.applications as Array<{ count: number }> | null)?.[0]?.count ?? 0))
    .filter((slot) => slot.booked < slot.capacity);
}

/** Every slot from the start of today (Manila), with who booked it, for the portal. */
export async function getSlotsForPortal(college = ""): Promise<AdminInterviewSlot[]> {
  if (!isSupabaseConfigured()) return [];
  const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date())}T00:00:00+08:00`);
  // One round trip: each slot comes with who booked it (via applications.interview_slot_id).
  const readSlots = (withMiddleName: boolean) => createAdminClient()
    .from("interview_slots")
    .select(`*, applications(id, first_name, ${withMiddleName ? "middle_name, " : ""}middle_initial, last_name, reference_code, position, email, facebook_url, college, program, year_level)`)
    .eq("college", college)
    .gte("starts_at", today.toISOString())
    .order("starts_at");
  let result = await readSlots(true);
  if (isMiddleNameColumnMissing(result.error)) result = await readSlots(false);
  const { data: slots, error } = result;
  if (error) throw new Error(`Couldn’t load interview slots: ${error.message}`);
  return slots.map((slot) => {
    const booked = (slot.applications as Row[] | null) ?? [];
    return {
      ...toSlot(slot, booked.length),
      createdBy: slot.created_by as string,
      bookings: booked.map((booking) => ({
        id: booking.id as string,
        name: applicantName({ first_name: booking.first_name as string, middle_name: booking.middle_name as string | null, middle_initial: booking.middle_initial as string | null, last_name: booking.last_name as string }),
        referenceCode: booking.reference_code as string,
        position: booking.position as string,
        lastName: (booking.last_name as string) ?? "",
        firstName: (booking.first_name as string) ?? "",
        middleName: (booking.middle_name as string) || (booking.middle_initial as string) || "",
        email: (booking.email as string) ?? "",
        facebookUrl: (booking.facebook_url as string) ?? "",
        college: (booking.college as string) ?? "",
        program: (booking.program as string) ?? "",
        yearLevel: yearLevels[booking.year_level as keyof typeof yearLevels] ?? (booking.year_level as string) ?? "",
      })),
    };
  });
}

export async function getSlot(id: string): Promise<InterviewSlot | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createAdminClient().from("interview_slots").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn’t load the interview slot: ${error.message}`);
  return data ? toSlot(data, 0) : null;
}

export type NewSlot = { division: DivisionId; startsAt: string; durationMinutes: number; mode: InterviewMode; location: string | null; capacity: number };

export async function createSlots(slots: NewSlot[], author: string, college = "") {
  const rows = slots.map((slot) => ({ college, division: slot.division, starts_at: slot.startsAt, duration_minutes: slot.durationMinutes, mode: slot.mode, location: slot.location, capacity: slot.capacity, created_by: author }));
  const { error } = await createAdminClient().from("interview_slots").insert(rows);
  if (error) throw new Error(`Couldn’t add the interview slots: ${error.message}`);
}

/** Deletes a slot nobody has booked. Returns false if someone has. */
export async function deleteEmptySlot(id: string) {
  const { count, error: countError } = await createAdminClient().from("applications").select("id", { count: "exact", head: true }).eq("interview_slot_id", id);
  if (countError) throw new Error(`Couldn’t check the slot’s bookings: ${countError.message}`);
  if (count) return false;
  const { error } = await createAdminClient().from("interview_slots").delete().eq("id", id);
  if (error) throw new Error(`Couldn’t delete the slot: ${error.message}`);
  return true;
}
