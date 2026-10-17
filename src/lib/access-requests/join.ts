import "server-only";

import { isOfferResponse, offerStateOf } from "@/lib/applications/offer";
import { positionsForUnit, retentionCutoff } from "@/lib/applications/options";
import { createAdminClient } from "@/lib/supabase/server";
import type { JoinProfile } from "./channel";

// "Join the Commission", the first button in an acceptance email, opens Request access with
// ?join=<the application's reference code>. Once the requester has verified their UST account with
// Google, their accepted application fills in their profile, and the request is approved as soon as
// it's sent. The link alone shows nothing: the application has to be accepted, its offer still open
// (not declined, and within its 14 days), still kept (60 days), and sent from the very UST account
// that was just verified.

type Row = Record<string, string | null>;

const value = (row: Row, key: string) => (row[key] ?? "").trim();

/** The accepted application behind a join link, for the verified `email`; null if there's none. */
export async function findJoinProfile(referenceCode: string, email: string): Promise<JoinProfile | null> {
  const code = referenceCode.trim().toUpperCase();
  if (!code || code.length > 40) return null;
  const { data, error } = await createAdminClient()
    .from("applications")
    .select("*")
    .eq("reference_code", code)
    .eq("email", email.trim().toLowerCase())
    .eq("status", "accepted")
    .gte("created_at", retentionCutoff())
    .maybeSingle();
  if (error) {
    console.error("Couldn’t look up the application for Join the Commission:", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as Row;
  // Declined, or past its 14 days. (Before migration 0088 offers have no deadline.)
  const offer = offerStateOf(value(row, "status"), isOfferResponse(row.offer_response) ? row.offer_response : null, row.offer_expires_at ?? null);
  if (offer === "declined" || offer === "lapsed") return null;
  const affiliation = value(row, "preferred_body");
  if (affiliation !== "central" && affiliation !== "local") return null;
  const college = value(row, "college");
  const office = positionsForUnit(affiliation === "local" ? college : "").find((item) => item.id === value(row, "position_id"));
  // The position was renamed or removed since they applied: the Executive Board places them by hand.
  if (!office) return null;
  const middleName = value(row, "middle_name") || value(row, "middle_initial");
  return {
    referenceCode: value(row, "reference_code"),
    lastName: value(row, "last_name").toUpperCase(),
    firstName: value(row, "first_name").toUpperCase(),
    middleInitial: middleName.charAt(0).toUpperCase(),
    middleName: middleName.toUpperCase(),
    studentNumber: value(row, "student_number"),
    contactNumber: value(row, "contact_number"),
    facebookUrl: value(row, "facebook_url"),
    college,
    program: value(row, "program"),
    yearLevel: value(row, "year_level"),
    affiliation,
    position: office.position,
    role: office.role,
    appliedFor: office.label,
  };
}
