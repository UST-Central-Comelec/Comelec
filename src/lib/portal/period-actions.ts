"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearApplyPageCache } from "@/lib/applications/apply-cache";
import { comelecUnits } from "@/lib/applications/options";
import { requireEditor } from "@/lib/auth/session";
import { canManageEvent, isOwn } from "@/lib/events/access";
import { detailsSchema, readDetails, toDetails } from "@/lib/events/details";
import { comelecUnit, manilaMoment } from "@/lib/events/options";
import { concernOf } from "@/lib/notifications/concern";
import { actorOf } from "@/lib/notifications/notify";
import { periodChange, settingChanged, type SettingKey } from "@/lib/notifications/settings-emails";
import { isPeriodKind, listingId, periodKinds, settingsHref, unitFromKey, type PeriodKind, type Unit } from "@/lib/periods/kinds";
import { getUnitPeriod, saveUnitPeriod } from "@/lib/periods/store";
import { text, toFormState, type FormState } from "./form";
import { canCancelClosing, graceEnd, modeAfterCancel } from "./period-form";

// A unit's Recruitment, Political Party Registration and Filing of Candidacy, from each one's
// Settings subtab: one form with the event details it's listed under while it's open, whose start
// and end are when it opens and closes, and whether it's scheduled or closed.
// Every unit has its own of each. A Local account changes only its own college's, a Central account
// the Central Comelec's, and the Central Executive Board any unit's (src/lib/events/access.ts).
//
// The pages bind `kind` and the unit's college ("" for the Central Comelec) to these. Both are
// checked again here, since bound values come back from the browser.

/** The signed-in account and the unit it asked to change, if that unit's settings are its to change. */
async function requireUnit(kind: PeriodKind, college: string) {
  if (!isPeriodKind(kind) || typeof college !== "string") redirect("/portal");
  const user = await requireEditor(periodKinds[kind].tab);
  const unit = unitFromKey(college);
  // A unit the commission doesn't have is nobody's to open, unless it's the account's own (a college set by hand).
  const known = unit.organizer === "central" || comelecUnits.includes(college) || isOwn(user, unit);
  if (!known || !canManageEvent(user, unit)) redirect(periodKinds[kind].settingsHref);
  return { user, unit };
}

/** The unit's Settings subtab, with a notice. */
const back = (kind: PeriodKind, unit: Unit, notice: string) => {
  const href = settingsHref(kind, unit);
  return `${href}${href.includes("?") ? "&" : "?"}notice=${notice}`;
};

/** The notices are worded for applications or for a filing (src/components/portal/notice.tsx). */
const noticeOf = (kind: PeriodKind, what: string) => `${kind === "recruitment" ? "period" : "filing"}-${what}`;

/** Each kind as a sentence names it, for the emails about it: the Central Comelec's plainly, a Local unit's as that unit's. */
function named(kind: PeriodKind, unit: Unit) {
  const what = { recruitment: "commissioner applications", "party-registration": "party registration", candidacy: "filing of candidacy" }[kind];
  if (unit.organizer === "local") return `the ${comelecUnit("local", unit.college)}’s ${what}`;
  return kind === "candidacy" ? `the ${what}` : what;
}

const emailKeys: Record<PeriodKind, SettingKey> = { recruitment: "setting-recruitment", "party-registration": "setting-filings", candidacy: "setting-filings" };

/** How the emails about a unit's period name it, where it's set, and who's told: the unit itself. */
const emailOf = (kind: PeriodKind, unit: Unit) => ({ key: emailKeys[kind], what: named(kind, unit), section: periodKinds[kind].section, path: settingsHref(kind, unit), concern: concernOf(unit.organizer, unit.college) });

function refresh(kind: PeriodKind, unit: Unit) {
  if (kind === "recruitment") clearApplyPageCache();
  // Every site page: the menu and the home page say what's open, and the Events page lists it.
  revalidatePath("/", "layout");
  revalidatePath(`/events/${listingId(kind, unit)}`);
  revalidatePath(periodKinds[kind].settingsHref);
  revalidatePath("/portal/events");
}

/**
 * Saves a unit's Settings form: its event details, and whether it's scheduled or closed. A scheduled
 * period opens at the details' start date and time and closes by itself at their end date and time.
 * Closing it takes effect after the grace period, so anyone partway through the form can finish.
 */
export async function updateUnitPeriod(kind: PeriodKind, college: string, _state: FormState, formData: FormData): Promise<FormState> {
  const { user, unit } = await requireUnit(kind, college);
  const picked = text(formData, "mode");
  if (picked !== "scheduled" && picked !== "closed") return { error: "Choose whether it’s scheduled or closed." };
  const mode: "scheduled" | "closed" = picked;

  const raw = readDetails(formData);
  // Recruitment accepts University students only, regardless of submitted participant fields.
  if (kind === "recruitment") {
    raw.openToStudents = true;
    raw.openToExternals = false;
    raw.openToAdmins = false;
  }
  if (raw.venueMode === "both" && kind !== "recruitment") return { error: "Check the highlighted fields.", fieldErrors: { venueMode: "Pick on-site or online." } };
  const parsed = detailsSchema.safeParse(raw);
  // Closing doesn't need the details, as long as nothing's been typed in them that would be lost.
  if (!parsed.success && (mode === "scheduled" || raw.summary.trim() || raw.venueDetails.trim())) return toFormState(parsed.error);
  const details = parsed.success ? toDetails(parsed.data) : undefined;
  const opensAt = details ? new Date(manilaMoment(details.eventDate, details.startsTime)).toISOString() : undefined;
  const closesAt = details ? new Date(manilaMoment(details.endDate, details.endsTime)).toISOString() : undefined;
  if (mode === "scheduled" && Date.parse(closesAt!) <= Date.now()) {
    return { error: "Check the highlighted fields.", fieldErrors: { endDate: "That end date and time has already passed. Pick a later one, or choose Closed." } };
  }

  let notice: string;
  try {
    const before = await getUnitPeriod(kind, unit);
    const after = mode === "scheduled"
      ? { mode, opensAt, closesAt: closesAt!, graceEndsAt: null }
      : { mode, opensAt, closesAt: closesAt ?? before.closesAt, graceEndsAt: graceEnd(before) };
    await saveUnitPeriod(kind, unit, after, user.email, details);
    // The unit is told, unless saving changed nothing.
    const change = periodChange({ ...emailOf(kind, unit), before, after, by: actorOf(user) });
    if (change) settingChanged(change);
    notice = mode === "scheduled" ? noticeOf(kind, "dates") : before.mode === "closed" ? "details-saved" : noticeOf(kind, after.graceEndsAt ? "closed" : "closed-now");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save." };
  }

  refresh(kind, unit);
  redirect(back(kind, unit, notice));
}

/** Stops a close that's still in its grace period: back to the schedule if its date is still ahead, otherwise open. */
export async function cancelUnitClosing(kind: PeriodKind, college: string) {
  const { user, unit } = await requireUnit(kind, college);

  const current = await getUnitPeriod(kind, unit);
  if (!canCancelClosing(current)) redirect(back(kind, unit, noticeOf(kind, "cancel-too-late")));
  const after = { mode: modeAfterCancel(current), closesAt: current.closesAt, graceEndsAt: null };
  await saveUnitPeriod(kind, unit, after, user.email);
  const change = periodChange({ ...emailOf(kind, unit), before: current, after, by: actorOf(user), cancelled: true });
  if (change) settingChanged(change);
  refresh(kind, unit);
  redirect(back(kind, unit, noticeOf(kind, "close-cancelled")));
}
