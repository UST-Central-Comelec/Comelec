"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFullAccess } from "@/lib/auth/session";
import { actorOf } from "@/lib/notifications/notify";
import { settingChanged } from "@/lib/notifications/settings-emails";
import { expiryEnd, formatExpiry } from "./expiry";
import { getExpiryDate, saveAccountExpiry } from "./expiry-store";
import { text, type FormState } from "./form";

// Accounts → Expiration: the date commissioners' access ends. Only the Central Executive Board gets here.
// A new date is emailed to the Central Comelec.

export async function updateAccountExpiry(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireFullAccess();
  const date = text(formData, "expiresOn");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(expiryEnd(date))) return { error: "Check the highlighted field.", fieldErrors: { expiresOn: "Pick a date." } };
  // A date already past would revoke everyone on the next click.
  if (expiryEnd(date) <= Date.now()) return { error: "Check the highlighted field.", fieldErrors: { expiresOn: "Pick today or a later date." } };

  try {
    const before = await getExpiryDate();
    await saveAccountExpiry(date, user.email);
    if (date !== before) {
      const by = actorOf(user);
      settingChanged({
        key: "setting-access",
        section: "Accounts",
        headline: `Commissioners’ access now ends on ${formatExpiry(date)}`,
        title: "Expiry date *changed*",
        summary: `${by.name} changed the date commissioners’ portal access ends. At the end of that day every Executive Board member’s, Executive Associate’s and Deputy’s account is revoked; official accounts, Advisers and Admins keep theirs.`,
        rows: [["Access ends", formatExpiry(date)], ["Before", formatExpiry(before)]],
        by,
        path: "/portal/accounts/expiration",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Couldn’t save the expiry date:", message);
    if (message.includes("account_expiry") || message.includes("schema cache")) return { error: "The database needs an update first. Run supabase/migrations/0023_account_expiry.sql in the Supabase SQL Editor, then save again." };
    return { error: "Something went wrong saving the date. Please try again." };
  }
  revalidatePath("/portal", "layout");
  redirect("/portal/accounts/expiration?notice=expiry-saved");
}
