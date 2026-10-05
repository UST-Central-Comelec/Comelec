import "server-only";
import { notFound } from "next/navigation";
import { requireAccess, type PortalUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import type { PartyDocument, PartyRegistration } from "./schema";

export type PartyReview = { receivedBy?: string; certifiedBy?: string; receivedAt?: string; checked?: string[]; remarks?: string };
export type PartyRecord = { id: string; reference: string; party_name: string; college: string; email: string; created_at: string; payload: PartyRegistration; documents: PartyDocument[]; review: PartyReview; reviewed_by: string | null; reviewed_at: string | null };

export function canReadParty(user: Pick<PortalUser, "affiliation" | "college">, college: string) {
  return user.affiliation !== "local" || (user.college !== null && user.college === college);
}

export async function listPartyRegistrations() {
  const user = await requireAccess("polpar/registrations");
  let query = createAdminClient().from("party_registrations").select("id, reference, party_name, college, email, created_at").order("created_at", { ascending: false }).limit(500);
  if (user.affiliation === "local") {
    if (!user.college) return [];
    query = query.eq("college", user.college);
  }
  const { data, error } = await query;
  if (error) throw new Error("Couldn’t load registrations. Check that migration 0032_party_registrations.sql has been applied.");
  return data as Pick<PartyRecord, "id" | "reference" | "party_name" | "college" | "email" | "created_at">[];
}

export async function getPartyRegistration(id: string): Promise<PartyRecord> {
  const user = await requireAccess("polpar/registrations");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Scope the query itself: a Local user never retrieves another unit’s record.
  let query = createAdminClient().from("party_registrations").select("*").eq("id", id);
  if (user.affiliation === "local") {
    if (!user.college) notFound();
    query = query.eq("college", user.college);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Couldn’t load this registration.");
  if (!data || !canReadParty(user, data.college)) notFound();
  return data as PartyRecord;
}
