import "server-only";

import { positionsForUnit, retentionCutoff } from "@/lib/applications/options";
import { officeOf } from "@/lib/data/accounts";
import { createAdminClient } from "@/lib/supabase/server";
import type { JoinProfile } from "./channel";

// "Join the Commission", the first button in an acceptance email, opens Request access with
// ?join=<the application's reference code>. Once the requester has verified their UST account with
// Google, their accepted application fills in their profile, and the request is approved as soon as
// it's sent. The link alone shows nothing: the application has to be accepted, still kept (60 days),
// and sent from the very UST account that was just verified.

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
    position: "executive-associate",
    role: officeOf(office.role),
    appliedFor: value(row, "position") || office.label,
  };
}
