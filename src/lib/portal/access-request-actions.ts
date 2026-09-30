"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { decideAccessRequest, getAccessRequest } from "@/lib/access-requests/admin";
import { accessDecisionEmail } from "@/lib/access-requests/emails";
import { greetingName } from "@/lib/applications/emails";
import { isBuiltInEmail, requireExecutive } from "@/lib/auth/session";
import { isMissingColumn, store } from "@/lib/data/store";
import { isAccountRole, isAffiliation, type AccountRole } from "@/lib/data/types";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/server";
import { text } from "./form";

// Executives decide portal access requests on the Accounts page. Approving adds the account (as
// the role and affiliation picked, with the college from the request) so the requester can sign in; either way the requester is emailed, and sees
// the decision when they track the request.

function done(notice: string): never {
  revalidatePath("/portal/accounts");
  redirect(`/portal/accounts?notice=${notice}`);
}

/** The first name from "JUAN P. DELA CRUZ", for the email's greeting. */
const firstNameOf = (name: string) => name.split(/\s+[\p{L}]\.\s+/u)[0] ?? name;

export async function approveAccessRequest(id: string, formData: FormData) {
  const executive = await requireExecutive();
  const roleInput = text(formData, "role");
  const role: AccountRole = isAccountRole(roleInput) ? roleInput : "commissioner";
  const picked = text(formData, "affiliation");
  const request = await getAccessRequest(id);
  if (!request || request.status !== "pending") done("access-request-gone");

  // Decided first: only one executive's approval goes through, even if two click at once.
  if (!(await decideAccessRequest(id, "approved", executive.email))) done("access-request-gone");

  const { email, name, referenceCode, college } = request;
  // Executives are always Central (supabase/migrations/0017).
  const affiliation = role === "executive" ? "central" : isAffiliation(picked) ? picked : request.affiliation;
  const exists = isBuiltInEmail(email) || (await store.list("accounts")).some((account) => account.email === email);
  if (!exists) {
    try {
      await store.create("accounts", { name: greetingName(name), email, role, affiliation, college, active: true }, executive.email, `account ${name}`);
    } catch (error) {
      // Put it back so it can be approved again.
      await createAdminClient().from("access_requests").update({ status: "pending", decided_at: null, decided_by: null }).eq("id", id);
      if (isMissingColumn(error, ["affiliation", "college"])) done("access-needs-migration");
      throw error;
    }
  }

  after(() => sendEmail(accessDecisionEmail({ email, firstName: firstNameOf(name), referenceCode }, true)));
  revalidatePath("/portal", "layout");
  done("access-approved");
}

export async function declineAccessRequest(id: string) {
  const executive = await requireExecutive();
  const request = await getAccessRequest(id);
  if (!request || !(await decideAccessRequest(id, "declined", executive.email))) done("access-request-gone");

  const { email, name, referenceCode } = request;
  after(() => sendEmail(accessDecisionEmail({ email, firstName: firstNameOf(name), referenceCode }, false)));
  done("access-declined");
}
