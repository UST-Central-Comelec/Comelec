"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { decideAccessRequest, getAccessRequest } from "@/lib/access-requests/admin";
import { accessDecisionEmail } from "@/lib/access-requests/emails";
import { isBuiltInEmail, requireEditor } from "@/lib/auth/session";
import { fullName, isCentralRepresentative, isRoleFor, toSummary, upperName } from "@/lib/data/accounts";
import { isMissingColumn, store } from "@/lib/data/store";
import { accountPositions, describeAffiliation, isAffiliation, isCommissionerPosition } from "@/lib/data/types";
import type { Details } from "@/lib/email/template";
import { concernOf } from "@/lib/notifications/concern";
import { sendAutomatic } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/server";
import { canDecideRequest, canManageAccount } from "./account-scope";
import { text } from "./form";

// Portal access requests are decided on the Accounts page, by whoever manages that unit's accounts
// (./account-scope.ts). Approving adds a commissioner's account with the details from the request
// and the affiliation, position and role picked on the row, so the requester can sign in. Their email is
// already verified: they proved it with Google twice to send the request. Either way the requester
// is emailed the decision with their details, and sees it when they track the request.

function done(notice: string): never {
  revalidatePath("/portal/accounts");
  redirect(`/portal/accounts?notice=${notice}`);
}

export async function approveAccessRequest(id: string, formData: FormData) {
  const manager = await requireEditor("accounts");
  const request = await getAccessRequest(id);
  if (!request || request.status !== "pending" || !canDecideRequest(manager, request)) done("access-request-gone");

  const affiliation = text(formData, "affiliation");
  const position = text(formData, "position");
  const role = text(formData, "role");
  if (!isAffiliation(affiliation) || !isCommissionerPosition(position) || !isRoleFor(affiliation, position, role)) done("access-needs-role");
  const { email, referenceCode, college } = request;
  if (!canManageAccount(manager, { kind: "personal", affiliation, position, college })) done("access-out-of-reach");

  const accounts = await store.list("accounts");
  const representative = isCentralRepresentative({ affiliation, position, role }) && accounts.map(toSummary).some((account) => account.active && account.kind === "personal" && account.college === college && isCentralRepresentative(account));
  if (representative) done("access-role-taken");

  // Decided first: only one approval goes through, even if two people click at once.
  if (!(await decideAccessRequest(id, "approved", manager.email))) done("access-request-gone");

  // Names are kept in capitals, as the request form sends them.
  const firstName = upperName(request.firstName);
  const lastName = upperName(request.lastName);
  const exists = isBuiltInEmail(email) || accounts.some((account) => account.email === email);
  if (!exists) {
    try {
      await store.create(
        "accounts",
        {
          kind: "personal",
          name: fullName({ firstName, middleInitial: request.middleInitial, lastName }),
          lastName,
          firstName,
          middleInitial: request.middleInitial || null,
          email,
          studentNumber: request.studentNumber,
          affiliation,
          position,
          role,
          college,
          program: request.program,
          facebookUrl: request.facebookUrl,
          emailVerifiedAt: new Date().toISOString(),
          photoUrl: null,
          chamberRole: null,
          active: true,
        },
        manager.email,
        `account ${firstName} ${lastName}`,
      );
    } catch (error) {
      // Put it back so it can be approved again.
      await createAdminClient().from("access_requests").update({ status: "pending", decided_at: null, decided_by: null }).eq("id", id);
      if (isMissingColumn(error, ["last_name", "first_name", "position", "email_verified_at", "kind"])) done("access-needs-migration");
      throw error;
    }
  }

  // Their details as the account was added: the unit, position and role picked here may differ from what they asked for.
  const account: Details = [
    ["Name", fullName({ firstName, middleInitial: request.middleInitial, lastName })],
    ["UST email", email],
    ["Serves in", describeAffiliation(affiliation, college)],
    ["Position", accountPositions[position]],
    ["Role", role],
    ["Program", request.program],
    ["Student number", request.studentNumber],
  ];
  after(() => sendAutomatic("access-approved", () => accessDecisionEmail({ email, firstName: request.firstName, referenceCode, concern: concernOf(affiliation, college) }, true, account)));
  // The new account is in the Directory straight away.
  revalidatePath("/about");
  revalidatePath("/");
  revalidatePath("/portal", "layout");
  done("access-approved");
}

export async function declineAccessRequest(id: string) {
  const manager = await requireEditor("accounts");
  const request = await getAccessRequest(id);
  if (!request || !canDecideRequest(manager, request) || !(await decideAccessRequest(id, "declined", manager.email))) done("access-request-gone");

  const { email, firstName, referenceCode } = request;
  // Their details as they sent them.
  const asked: Details = [
    ["Name", request.name],
    ["UST email", email],
    ["Requested for", describeAffiliation(request.affiliation, request.college)],
    ...(request.position ? ([["Position", accountPositions[request.position]]] satisfies Details) : []),
    ["Role", request.role],
    ["Program", request.program],
    ["Student number", request.studentNumber],
  ];
  after(() => sendAutomatic("access-declined", () => accessDecisionEmail({ email, firstName, referenceCode, concern: concernOf(request.affiliation, request.college) }, false, asked)));
  done("access-declined");
}
