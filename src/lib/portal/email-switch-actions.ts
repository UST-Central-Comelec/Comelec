"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { emailName } from "@/lib/notifications/catalog";
import { actorOf } from "@/lib/notifications/notify";
import { settingChanged } from "@/lib/notifications/settings-emails";
import { getSavedSwitches, isSwitchesMissing, saveSwitches } from "@/lib/notifications/switch-store";
import { emailKeys, isEmailKey, overridesFor, switchesWith } from "@/lib/notifications/switches";
import { switchesEmails } from "./access";
import type { FormState } from "./form";

// Apps → Email Sender → Automatic: which of the emails the site sends by itself are switched on.
// The switches are the whole commission's, so only the Central Executive Board and the Central
// Comelec's official account change them (switchesEmails); anyone else with the Email Sender sees
// how they stand, and is refused here whatever the page shows.

const PAGE = "/portal/apps/email/automatic";

export async function updateEmailSwitches(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("apps/email");
  if (!switchesEmails(user.level)) redirect(PAGE);
  // The switches that are on; every other email is off.
  const overrides = overridesFor(formData.getAll("email").filter(isEmailKey));
  // The email that was being looked at, to come back to.
  const shown = formData.get("shown");
  const back = `${PAGE}?${isEmailKey(shown) ? `email=${shown}&` : ""}${formData.get("unit") === "local" ? "unit=local&" : ""}notice=email-switches-saved`;

  try {
    const before = (await getSavedSwitches()).switches;
    await saveSwitches(overrides, user.email);

    const after = switchesWith(overrides);
    const on = emailKeys.filter((key) => after[key] && !before[key]);
    const off = emailKeys.filter((key) => before[key] && !after[key]);
    if (on.length || off.length) {
      const by = actorOf(user);
      const count = (keys: typeof on, verb: string) => (keys.length ? [`${keys.length} ${keys.length === 1 ? "email" : "emails"} switched ${verb}`] : []);
      settingChanged(
        {
          key: "setting-email",
          section: "Automatic emails",
          label: "Automatic emails",
          headline: [...count(on, "on"), ...count(off, "off")].join(", "),
          title: "Automatic emails *changed*",
          summary: `${by.name} changed which emails the site sends by itself. It applies from the next one.`,
          rows: [["Switched on", on.map(emailName).join("; ")], ["Switched off", off.map(emailName).join("; ")]],
          by,
          path: PAGE,
        },
        // Switching these notices off is itself announced, so nobody can turn them off unnoticed.
        { always: before["setting-email"] },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Couldn’t save the email switches:", message);
    if (isSwitchesMissing(message)) return { error: "The database needs an update first. Run supabase/migrations/0026_email_settings.sql in the Supabase SQL Editor, then save again." };
    return { error: "Something went wrong saving the switches. Please try again." };
  }

  revalidatePath("/portal", "layout");
  redirect(back);
}
