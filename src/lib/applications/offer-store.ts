import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { reapplyFrom, type OfferResponse } from "./offer";

// Saving how an acceptance offer was answered (./offer.ts, supabase/migrations/0088). Before 0088
// is run there's nowhere to save it: offers have no deadline, Decline says it can't be done online,
// and nobody is held back from applying again.

const MIGRATION = "supabase/migrations/0088_acceptance_offers.sql";

const isMissing = (error: { code?: string; message: string } | null) =>
  Boolean(error && ["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "") && /offer_|application_holds/.test(error.message));

/** A unit is the Central Comelec ("central", college "") or one college's Local Comelec. */
type Unit = { preferredBody: string; college: string };
const unitCollege = ({ preferredBody, college }: Unit) => (preferredBody === "local" ? college : "");

/** Starts the 14 days, once the acceptance email that says so has gone. */
export async function openOffer(id: string, expiresAt: string) {
  const { error } = await createAdminClient().from("applications").update({ offer_expires_at: expiresAt }).eq("id", id).eq("status", "accepted").is("offer_response", null);
  if (error) console.error(isMissing(error) ? `Acceptance offers need ${MIGRATION}; this one has no deadline.` : `Couldn’t save the offer’s deadline: ${error.message}`);
}

/** Their account in the unit is ready (Join the Commission, or Onboard): the offer was taken. */
export async function markOfferJoined(email: string, unit: Unit) {
  if (!isSupabaseConfigured()) return;
  let query = createAdminClient().from("applications").update({ offer_response: "joined", offer_responded_at: new Date().toISOString() })
    .eq("email", email.trim().toLowerCase()).eq("status", "accepted").eq("preferred_body", unit.preferredBody).is("offer_response", null);
  if (unit.preferredBody === "local") query = query.eq("college", unit.college);
  const { error } = await query;
  if (error && !isMissing(error)) console.error("Account added, but couldn’t mark the offer as taken:", error.message);
}

export type DeclineResult = "declined" | "closed" | "unavailable";

/**
 * The applicant declines their open offer: the application is no longer accepted (its slot goes
 * back), and they wait 60 days to apply to the unit again. "closed": it was answered, lapsed or
 * changed in the meantime.
 */
export async function declineOffer(application: Unit & { id: string; email: string; referenceCode: string }): Promise<DeclineResult> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient().from("applications")
    .update({ status: "declined", offer_response: "declined" satisfies OfferResponse, offer_responded_at: now, status_updated_at: now, status_updated_by: "Applicant" })
    .eq("id", application.id).eq("status", "accepted").is("offer_response", null).or(`offer_expires_at.is.null,offer_expires_at.gt."${now}"`)
    .select("id").maybeSingle();
  if (isMissing(error)) {
    console.error(`Declining an offer needs ${MIGRATION}.`);
    return "unavailable";
  }
  if (error) throw new Error(`Couldn’t decline the offer: ${error.message}`);
  if (!data) return "closed";

  const hold = { email: application.email.trim().toLowerCase(), preferred_body: application.preferredBody, college: unitCollege(application), reference_code: application.referenceCode, reason: "declined", until: reapplyFrom(now), created_at: now };
  const { error: holdError } = await createAdminClient().from("application_holds").upsert(hold, { onConflict: "email,preferred_body,college" });
  // The offer is declined either way; only the wait to apply again couldn't be saved.
  if (holdError) console.error("Offer declined, but couldn’t save the wait to apply again:", holdError.message);
  return "declined";
}

export type ReapplyHold = { body: string; college: string; reason: "declined" | "lapsed"; until: string };

/** The units this email can't apply to yet, after declining an offer or letting one lapse. */
export async function getReapplyHolds(email: string): Promise<ReapplyHold[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient().from("application_holds").select("preferred_body, college, reason, until")
    .eq("email", email.trim().toLowerCase()).gt("until", new Date().toISOString());
  if (isMissing(error)) return [];
  if (error) throw new Error(`Couldn’t check for a wait to apply again: ${error.message}`);
  return (data ?? []).map((row) => ({ body: row.preferred_body as string, college: row.college as string, reason: row.reason === "lapsed" ? "lapsed" : "declined", until: row.until as string }));
}
