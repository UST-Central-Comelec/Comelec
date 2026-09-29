"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePortalUser } from "@/lib/auth/session";
import { clearApplyPageCache } from "@/lib/applications/apply-cache";
import { createSlots, deleteEmptySlot, type NewSlot } from "@/lib/applications/interviews";
import { divisions, type DivisionId } from "@/lib/applications/options";
import { text, type FormState } from "./form";

/** Most days one submission can cover (a month's worth, from dragging across the calendar). */
const MAX_DAYS = 31;

/**
 * Adds one slot, or a run of back-to-back slots, on each chosen day (Manila time). Several days
 * come from selecting a group of dates on the calendar; they all get the same times and details.
 */
export async function addInterviewSlots(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();

  const division = text(formData, "division");
  const dates = [...new Set(formData.getAll("date").filter((value): value is string => typeof value === "string"))].sort();
  const time = text(formData, "time");
  const duration = Number(text(formData, "duration"));
  const count = Number(text(formData, "count") || "1");
  const capacity = Number(text(formData, "capacity") || "1");
  const mode = text(formData, "mode");
  const location = text(formData, "location").trim().slice(0, 200) || null;

  const fieldErrors: Record<string, string> = {};
  if (!(division in divisions)) fieldErrors.division = "Pick the division holding these interviews.";
  if (!dates.length || !dates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))) fieldErrors.date = "Pick a date.";
  else if (dates.length > MAX_DAYS) fieldErrors.date = `Pick up to ${MAX_DAYS} days at a time.`;
  if (!/^\d{2}:\d{2}$/.test(time)) fieldErrors.time = "Pick a start time.";
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) fieldErrors.duration = "Pick a length.";
  if (!Number.isInteger(count) || count < 1 || count > 24) fieldErrors.count = "Use a number from 1 to 24.";
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) fieldErrors.capacity = "Use a number from 1 to 100.";
  if (mode !== "online" && mode !== "onsite") fieldErrors.mode = "Pick online or on-site.";

  const starts = dates.map((date) => new Date(`${date}T${time}:00+08:00`));
  if (!fieldErrors.date && !fieldErrors.time && starts.some((start) => Number.isNaN(start.getTime()) || start.getTime() < Date.now())) {
    fieldErrors.time = dates.length > 1 ? "One of the days has already passed at that time. Pick later days or a later time." : "Pick a time that hasn’t passed.";
  }
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  const slots: NewSlot[] = starts.flatMap((first) =>
    Array.from({ length: count }, (_, index) => ({
      division: division as DivisionId,
      startsAt: new Date(first.getTime() + index * duration * 60_000).toISOString(),
      durationMinutes: duration,
      mode: mode as NewSlot["mode"],
      location,
      capacity,
    })),
  );

  try {
    await createSlots(slots, email);
    clearApplyPageCache();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t add the slots." };
  }

  revalidatePath("/apply");
  revalidatePath("/portal/recruitment/interviews");
  redirect(`/portal/recruitment/interviews?division=${division}&day=${dates[0]}&notice=${slots.length === 1 ? "slot-added" : "slots-added"}`);
}

/** `day` ("YYYY-MM-DD") keeps the calendar on the same day afterwards. */
export async function deleteInterviewSlot(id: string, day?: string) {
  await requirePortalUser();
  const deleted = await deleteEmptySlot(id);
  clearApplyPageCache();
  revalidatePath("/apply");
  revalidatePath("/portal/recruitment/interviews");
  const keepDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `&day=${day}` : "";
  redirect(`/portal/recruitment/interviews?notice=${deleted ? "slot-deleted" : "slot-booked"}${keepDay}`);
}
