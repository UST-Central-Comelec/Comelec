import "server-only";

import { toSummary } from "@/lib/data/accounts";
import { commissionerPositions, type PortalAccount } from "@/lib/data/types";
import { accountExpiredEmail } from "@/lib/notifications/account-emails";
import { later, sendEach } from "@/lib/notifications/notify";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_EXPIRY, expiryEnd } from "./expiry";

// Reads and saves the one row of public.account_expiry (supabase/migrations/0023), and revokes the
// commissioners' accounts once its date has passed, emailing each that their access has ended.

export type AccountExpiry = { expiresOn: string; sweptAt: string | null; updatedAt: string | null; updatedBy: string | null };

const fallback: AccountExpiry = { expiresOn: DEFAULT_EXPIRY, sweptAt: null, updatedAt: null, updatedBy: null };

export async function getAccountExpiry(): Promise<AccountExpiry> {
  if (!isSupabaseConfigured()) return fallback;
  const { data, error } = await createAdminClient().from("account_expiry").select("*").maybeSingle();
  if (error) throw new Error(`Couldn’t load the expiry date: ${error.message}`);
  if (!data) return fallback;
  return { expiresOn: data.expires_on as string, sweptAt: (data.swept_at as string | null) ?? null, updatedAt: data.updated_at as string, updatedBy: data.updated_by as string };
}

/** For pages that only show the date: the default where it can't be read. */
export const getExpiryDate = () => getAccountExpiry().then((expiry) => expiry.expiresOn, () => DEFAULT_EXPIRY);

/** A new date starts a new run: accounts restored or added since the last clean-up last until it. */
export async function saveAccountExpiry(expiresOn: string, author: string) {
  const { error } = await createAdminClient().from("account_expiry").upsert({ id: true, expires_on: expiresOn, swept_at: null, updated_at: new Date().toISOString(), updated_by: author }, { onConflict: "id" });
  checkedAt = 0;
  if (error) throw new Error(error.message);
}

// Asked on every portal request, so the answer is reused for a few seconds.
const TTL_MS = 15_000;
let checkedAt = 0;

/**
 * The clean-up: once the date has passed, revokes every commissioner's account, once for that
 * date. `keepEmail` (the built-in executive) is left alone. True when it revoked just now. Never
 * throws: before 0023 is run there's nothing to do, and signing in mustn't fail over it.
 */
export async function sweepExpiredAccounts(keepEmail: string | null): Promise<boolean> {
  const now = Date.now();
  if (!isSupabaseConfigured() || now - checkedAt < TTL_MS) return false;
  checkedAt = now;
  try {
    const expiry = await getAccountExpiry();
    if (!expiry.updatedAt || expiry.sweptAt || now <= expiryEnd(expiry.expiresOn)) return false;
    const client = createAdminClient();
    // Claimed first, so two requests arriving together don't both do it.
    const { data: claimed, error } = await client.from("account_expiry").update({ swept_at: new Date(now).toISOString() }).eq("id", true).is("swept_at", null).select("id");
    if (error || !claimed?.length) return false;
    let revoke = client.from("portal_accounts").update({ active: false, chamber_role: null, updated_at: new Date(now).toISOString(), updated_by: "system (expired)" }).eq("kind", "personal").eq("active", true).in("position", [...commissionerPositions]);
    if (keepEmail) revoke = revoke.neq("email", keepEmail);
    const { data: revoked, error: revokeError } = await revoke.select("*");
    if (revokeError) {
      // Put back, so the next request tries again.
      await client.from("account_expiry").update({ swept_at: null }).eq("id", true);
      console.error("Couldn’t revoke the expired accounts:", revokeError.message);
      return false;
    }
    // Each is told their access has ended, once whoever's request this is has their answer.
    const accounts = revoked.map((row) => toSummary({ ...row, firstName: row.first_name, studentNumber: row.student_number } as PortalAccount));
    later(() => sendEach("account-expired", accounts.map((account) => accountExpiredEmail(account, expiry.expiresOn))));
    return true;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return false;
  }
}
