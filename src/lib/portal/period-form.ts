import { CLOSE_GRACE_MINUTES, isUpcoming, type ApplicationPeriod, type PeriodMode } from "@/lib/applications/period";

// Closing a period from its Settings (src/lib/portal/period-actions.ts): the grace period that lets
// anyone partway through the form finish, and cancelling it.

/**
 * When a close saved now really takes effect: CLOSE_GRACE_MINUTES from now, so anyone partway
 * through the form can still submit. Never later than a scheduled close that was already coming,
 * and a close already under way keeps its time rather than starting the wait again.
 */
export function graceEnd(current: ApplicationPeriod) {
  if (current.mode === "closed") return current.graceEndsAt;
  // One that hasn't opened yet has nobody partway through.
  if (isUpcoming(current)) return null;
  const end = Date.now() + CLOSE_GRACE_MINUTES * 60_000;
  const scheduled = current.mode === "scheduled" && current.closesAt ? Date.parse(current.closesAt) : Infinity;
  return new Date(Math.min(end, Math.max(scheduled, Date.now()))).toISOString();
}

/** Whether a close can still be cancelled: it's still in its grace period. */
export const canCancelClosing = (current: ApplicationPeriod) => current.mode === "closed" && Boolean(current.graceEndsAt) && Date.parse(current.graceEndsAt!) > Date.now();

/** What cancelling a close goes back to: the schedule if its date is still ahead, otherwise open. */
export const modeAfterCancel = (current: ApplicationPeriod): PeriodMode => (current.closesAt && Date.parse(current.closesAt) > Date.now() ? "scheduled" : "open");
