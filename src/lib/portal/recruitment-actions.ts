"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePortalUser } from "@/lib/auth/session";
import { positions } from "@/lib/applications/options";
import { clearApplyPageCache } from "@/lib/applications/apply-cache";
import { CLOSE_GRACE_MINUTES, fromManilaInput, isPeriodMode, toManilaInput } from "@/lib/applications/period";
import { getApplicationPeriod, saveApplicationPeriod } from "@/lib/applications/period-store";
import { saveSlots } from "@/lib/applications/slots";
import { text, type FormState } from "./form";

/**
 * Saves the counts a commissioner changed. Accepting applicants lowers the counts on its own
 * (supabase/migrations/0009), so positions left untouched on the form aren't written back: a page
 * opened before an acceptance would otherwise restore the old number.
 */
export async function updateRecruitmentSlots(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();

  const counts: Record<string, number> = {};
  const fieldErrors: Record<string, string> = {};
  for (const position of positions) {
    const raw = text(formData, `slots-${position.id}`).trim() || "0";
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > 999) fieldErrors[`slots-${position.id}`] = "Use a whole number from 0 to 999.";
    else if (value !== Number(text(formData, `loaded-${position.id}`))) counts[position.id] = value;
  }
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
  if (!Object.keys(counts).length) redirect("/portal/recruitment/slots?notice=slots-unchanged");

  try {
    await saveSlots(counts, email);
    clearApplyPageCache();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the slots." };
  }

  revalidatePath("/apply");
  revalidatePath("/portal/recruitment/slots");
  redirect("/portal/recruitment/slots?notice=slots-saved");
}

/**
 * Opens or closes commissioner applications: close on a set date (with the countdown on /apply),
 * keep open with no end, or close right now. The closing date is kept in every mode, so switching
 * back to a schedule remembers it.
 */
export async function updateApplicationPeriod(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();

  const mode = text(formData, "mode");
  if (!isPeriodMode(mode)) return { error: "Choose whether applications are open or closed." };

  // Keep the saved time to the second when its field wasn't touched (the field only shows minutes).
  const input = text(formData, "closesAt").trim();
  const loaded = text(formData, "loadedClosesAt");
  const closesAt = loaded && input === toManilaInput(loaded) ? loaded : input ? fromManilaInput(input) : null;

  if (mode === "scheduled") {
    if (!closesAt) return { error: "Check the highlighted fields.", fieldErrors: { closesAt: "Pick the date and time applications close." } };
    if (Date.parse(closesAt) <= Date.now()) {
      return { error: "Check the highlighted fields.", fieldErrors: { closesAt: "That time has already passed. Pick a later one, or choose Close now." } };
    }
  } else if (input && !closesAt) {
    return { error: "Check the highlighted fields.", fieldErrors: { closesAt: "Use a valid date and time, or clear the field." } };
  }

  try {
    await saveApplicationPeriod({ mode, closesAt, graceEndsAt: mode === "closed" ? await graceEnd() : null }, email);
    clearApplyPageCache();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the application period." };
  }

  refreshPeriodPages();
  redirect(`/portal/recruitment/settings?notice=period-${mode}`);
}

/**
 * When a close saved now really takes effect: CLOSE_GRACE_MINUTES from now, so anyone partway
 * through the form can still submit. Never later than a scheduled close that was already coming,
 * and a close already under way keeps its time rather than starting the wait again.
 */
async function graceEnd() {
  const current = await getApplicationPeriod();
  if (current.mode === "closed") return current.graceEndsAt;
  const end = Date.now() + CLOSE_GRACE_MINUTES * 60_000;
  const scheduled = current.mode === "scheduled" && current.closesAt ? Date.parse(current.closesAt) : Infinity;
  return new Date(Math.min(end, Math.max(scheduled, Date.now()))).toISOString();
}

/** Stops a close that's still in its grace period: back to the schedule if its date is still ahead, otherwise open. */
export async function cancelClosing() {
  const { email } = await requirePortalUser();
  const current = await getApplicationPeriod();
  if (current.mode !== "closed" || !current.graceEndsAt || Date.parse(current.graceEndsAt) <= Date.now()) {
    redirect("/portal/recruitment/settings?notice=period-cancel-too-late");
  }
  const mode = current.closesAt && Date.parse(current.closesAt) > Date.now() ? "scheduled" : "open";
  await saveApplicationPeriod({ mode, closesAt: current.closesAt, graceEndsAt: null }, email);
  clearApplyPageCache();
  refreshPeriodPages();
  redirect("/portal/recruitment/settings?notice=period-close-cancelled");
}

function refreshPeriodPages() {
  revalidatePath("/");
  revalidatePath("/apply", "layout");
  revalidatePath("/portal/recruitment/settings");
}
