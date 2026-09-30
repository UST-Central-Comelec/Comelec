"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCentral } from "@/lib/auth/session";
import { positions } from "@/lib/applications/options";
import { clearApplyPageCache } from "@/lib/applications/apply-cache";
import { getApplicationPeriod, saveApplicationPeriod } from "@/lib/applications/period-store";
import { saveSlots } from "@/lib/applications/slots";
import { text, type FormState } from "./form";
import { canCancelClosing, graceEnd, modeAfterCancel, readPeriodForm } from "./period-form";

/**
 * Saves the counts a commissioner changed. Accepting applicants lowers the counts on its own
 * (supabase/migrations/0009), so positions left untouched on the form aren't written back: a page
 * opened before an acceptance would otherwise restore the old number.
 */
export async function updateRecruitmentSlots(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requireCentral();

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
  const { email } = await requireCentral();

  const form = readPeriodForm(formData);
  if ("error" in form) return form.error;
  const { mode, closesAt } = form;

  try {
    await saveApplicationPeriod({ mode, closesAt, graceEndsAt: mode === "closed" ? graceEnd(await getApplicationPeriod()) : null }, email);
    clearApplyPageCache();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the application period." };
  }

  refreshPeriodPages();
  redirect(`/portal/recruitment/settings?notice=period-${mode}`);
}

/** Stops a close that's still in its grace period: back to the schedule if its date is still ahead, otherwise open. */
export async function cancelClosing() {
  const { email } = await requireCentral();
  const current = await getApplicationPeriod();
  if (!canCancelClosing(current)) redirect("/portal/recruitment/settings?notice=period-cancel-too-late");
  await saveApplicationPeriod({ mode: modeAfterCancel(current), closesAt: current.closesAt, graceEndsAt: null }, email);
  clearApplyPageCache();
  refreshPeriodPages();
  redirect("/portal/recruitment/settings?notice=period-close-cancelled");
}

function refreshPeriodPages() {
  // Every site page: the menu's Featured card and the home page announcement follow the period.
  revalidatePath("/", "layout");
  revalidatePath("/portal/recruitment/settings");
}
