import { CLOSE_GRACE_MINUTES, fromManilaInput, isPeriodMode, toManilaInput, type ApplicationPeriod, type PeriodMode } from "@/lib/applications/period";
import { text, type FormState } from "./form";

// The open/close settings form (components/portal/application-period-form.tsx), shared by
// Recruitment → Settings, PolPaR → Settings and Filing of Candidacy → Settings.

/**
 * The period the form asks for, or the errors to show. The closing date is kept in every mode, so
 * switching back to a schedule remembers it.
 */
export function readPeriodForm(formData: FormData): { mode: PeriodMode; closesAt: string | null } | { error: FormState } {
  const mode = text(formData, "mode");
  if (!isPeriodMode(mode)) return { error: { error: "Choose whether it’s open or closed." } };

  // Keep the saved time to the second when its field wasn't touched (the field only shows minutes).
  const input = text(formData, "closesAt").trim();
  const loaded = text(formData, "loadedClosesAt");
  const closesAt = loaded && input === toManilaInput(loaded) ? loaded : input ? fromManilaInput(input) : null;

  if (mode === "scheduled") {
    if (!closesAt) return { error: { error: "Check the highlighted fields.", fieldErrors: { closesAt: "Pick the date and time it closes." } } };
    if (Date.parse(closesAt) <= Date.now()) {
      return { error: { error: "Check the highlighted fields.", fieldErrors: { closesAt: "That time has already passed. Pick a later one, or choose Close now." } } };
    }
  } else if (input && !closesAt) {
    return { error: { error: "Check the highlighted fields.", fieldErrors: { closesAt: "Use a valid date and time, or clear the field." } } };
  }
  return { mode, closesAt };
}

/**
 * When a close saved now really takes effect: CLOSE_GRACE_MINUTES from now, so anyone partway
 * through the form can still submit. Never later than a scheduled close that was already coming,
 * and a close already under way keeps its time rather than starting the wait again.
 */
export function graceEnd(current: ApplicationPeriod) {
  if (current.mode === "closed") return current.graceEndsAt;
  const end = Date.now() + CLOSE_GRACE_MINUTES * 60_000;
  const scheduled = current.mode === "scheduled" && current.closesAt ? Date.parse(current.closesAt) : Infinity;
  return new Date(Math.min(end, Math.max(scheduled, Date.now()))).toISOString();
}

/** Whether a close can still be cancelled: it's still in its grace period. */
export const canCancelClosing = (current: ApplicationPeriod) => current.mode === "closed" && Boolean(current.graceEndsAt) && Date.parse(current.graceEndsAt!) > Date.now();

/** What cancelling a close goes back to: the schedule if its date is still ahead, otherwise open. */
export const modeAfterCancel = (current: ApplicationPeriod): PeriodMode => (current.closesAt && Date.parse(current.closesAt) > Date.now() ? "scheduled" : "open");
