"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { comelecUnits, positionsForUnit } from "@/lib/applications/options";
import { clearApplyPageCache } from "@/lib/applications/apply-cache";
import { getSlots, saveSlots } from "@/lib/applications/slots";
import { canManageEvent, isOwn } from "@/lib/events/access";
import { unitFromKey } from "@/lib/periods/kinds";
import { concernOf } from "@/lib/notifications/concern";
import { actorOf } from "@/lib/notifications/notify";
import { settingChanged } from "@/lib/notifications/settings-emails";
import { text, type FormState } from "./form";

/**
 * Saves the counts a commissioner changed. Accepting applicants lowers the counts on its own
 * (supabase/migrations/0009), so positions left untouched on the form aren't written back: a page
 * opened before an acceptance would otherwise restore the old number.
 */
export async function updateRecruitmentSlots(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("recruitment/slots");
  const { email } = user;
  const college = text(formData, "unit");
  const unit = unitFromKey(college);
  if ((college && !comelecUnits.includes(college) && !isOwn(user, unit)) || !canManageEvent(user, unit)) return { error: "You can’t manage recruitment slots for this unit." };
  const href = `/portal/recruitment/slots${college ? `?unit=${encodeURIComponent(college)}` : ""}`;
  const back = (notice: string) => `${href}${college ? "&" : "?"}notice=${notice}`;

  const positions = positionsForUnit(college);
  const counts: Record<string, number> = {};
  const fieldErrors: Record<string, string> = {};
  for (const position of positions) {
    const raw = text(formData, `slots-${position.id}`).trim() || "0";
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > 999) fieldErrors[`slots-${position.id}`] = "Use a whole number from 0 to 999.";
    else if (value !== Number(text(formData, `loaded-${position.id}`))) counts[position.id] = value;
  }
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
  if (!Object.keys(counts).length) redirect(back("slots-unchanged"));

  try {
    const before = await getSlots(college);
    await saveSlots(counts, email, college);
    clearApplyPageCache();
    const changed = positions.filter((position) => position.id in counts && counts[position.id] !== before[position.id]);
    if (changed.length) {
      const by = actorOf(user);
      settingChanged({
        key: "setting-recruitment",
        section: "Recruitment",
        headline: changed.length === 1 ? `Open slots changed for ${changed[0].label}` : `Open slots changed for ${changed.length} positions`,
        title: "Open slots *changed*",
        summary: `${by.name} changed how many slots are open for ${changed.length === 1 ? "one position" : `${changed.length} positions`}. The Apply page shows the new counts, and a position with none left can’t be applied for.`,
        rows: changed.map((position) => [position.label, `${counts[position.id]} open (was ${before[position.id]})`]),
        by,
        path: href,
        concern: concernOf(unit.organizer, unit.college),
      });
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the slots." };
  }

  revalidatePath("/apply");
  revalidatePath("/portal/recruitment/slots");
  redirect(back("slots-saved"));
}
