"use server";

import { revalidatePath } from "next/cache";
import { isLocal, requireEditor } from "@/lib/auth/session";
import { isLocalChairperson, toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import type { AccountSummary, ChamberRole } from "@/lib/data/types";
import { accountChanges, accountUpdatedEmail } from "@/lib/notifications/account-emails";
import { actorOf, later, sendAutomatic } from "@/lib/notifications/notify";

// The Directory is filled in from Accounts, so there's nothing to add or edit here. The one thing
// set on the Directory itself is who leads the Chamber of Chairpersons.

/**
 * Makes a Local Chairperson the Chamber of Chairpersons' Primus or Vicar (null: a regular member).
 * There's one of each, so whoever held the role before becomes a regular member. Both are emailed
 * the change to their account.
 */
export async function setChamberRole(id: string, role: ChamberRole | null): Promise<{ error?: string }> {
  const user = await requireEditor("members");
  if (isLocal(user)) return { error: "Only the Central Comelec sets the Chamber of Chairpersons’ Primus and Vicar." };
  const accounts = (await store.list("accounts")).map(toSummary);
  const account = accounts.find((item) => item.id === id);
  if (!account || !account.active || !isLocalChairperson(account)) return { error: "Only Local Comelec Chairpersons are in the Chamber of Chairpersons." };
  if (account.chamberRole === role) return {};

  try {
    const holder = role && accounts.find((item) => item.chamberRole === role && item.id !== id);
    if (holder) await store.update("accounts", holder.id, { chamberRole: null }, user.email);
    await store.update("accounts", id, { chamberRole: role }, user.email);

    const by = actorOf(user);
    const tell = (before: AccountSummary, chamberRole: ChamberRole | null) => {
      const after = { ...before, chamberRole };
      later(() => sendAutomatic("account-updated", () => accountUpdatedEmail(after, accountChanges(before, after), by)));
    };
    tell(account, role);
    if (holder) tell(holder, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { error: message.includes("chamber_role") ? "Run supabase/migrations/0021_account_profiles_and_access.sql in the Supabase SQL Editor first." : message || "Couldn’t save the role." };
  }
  revalidatePath("/about");
  revalidatePath("/portal", "layout");
  return {};
}
