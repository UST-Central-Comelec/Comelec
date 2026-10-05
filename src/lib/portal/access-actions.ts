"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFullAccess } from "@/lib/auth/session";
import { actorOf } from "@/lib/notifications/notify";
import { settingChanged } from "@/lib/notifications/settings-emails";
import { accessLevels, editableLevels, isLocalLevel, isLocalTab, isTabKey, levelTabs, overridesFor, tabName, type EditableLevel } from "./access";
import { getSavedAccess, saveAccess } from "./access-store";
import type { FormState } from "./form";

// Accounts → Access Control: which tabs each level may open. Only the Central Executive Board gets here.
// The portal binds `level` to the action; it's checked again since bound values come back from the browser.
// A change is emailed to the Central Comelec, with the tabs the level gained and lost.

export async function updateAccess(level: EditableLevel, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireFullAccess();
  const { email } = user;
  if (!editableLevels.includes(level)) return { error: "Unknown access level." };

  // The ticked tabs. A Local level can't be given a Central-only tab, whatever the form says.
  const chosen = formData.getAll("tab").filter(isTabKey).filter((tab) => !isLocalLevel(level) || isLocalTab(tab));

  try {
    const before = levelTabs(level, (await getSavedAccess()).overrides);
    // Only what differs from the defaults is saved, so a level left at its defaults follows them.
    const overrides = overridesFor(level, chosen);
    await saveAccess(level, overrides, email);

    const after = levelTabs(level, { [level]: overrides });
    const gained = after.filter((tab) => !before.includes(tab));
    const lost = before.filter((tab) => !after.includes(tab));
    if (gained.length || lost.length) {
      const by = actorOf(user);
      const names = (tabs: typeof after) => tabs.map(tabName).join(", ");
      settingChanged({
        key: "setting-access",
        section: "Access Control",
        headline: `What ${accessLevels[level]} can open changed`,
        title: "Portal access *changed*",
        summary: `${by.name} changed which tabs of the Commission Portal are open to ${accessLevels[level]}. It applies to every account at that level from their next click.`,
        rows: [["Level", accessLevels[level]], ["Now also open", names(gained)], ["No longer open", names(lost)]],
        by,
        path: `/portal/accounts/access-control?level=${level}`,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Couldn’t save the access control:", message);
    if (message.includes("portal_access") || message.includes("schema cache")) return { error: "The database needs an update first. Run supabase/migrations/0021_account_profiles_and_access.sql in the Supabase SQL Editor, then save again." };
    return { error: "Something went wrong saving the access control. Please try again." };
  }

  // Every portal page: the sidebar and each tab's own check follow the new access.
  revalidatePath("/portal", "layout");
  redirect(`/portal/accounts/access-control?level=${level}&notice=access-saved`);
}
