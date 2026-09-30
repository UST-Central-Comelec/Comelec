import "server-only";

import { finishPage } from "@/lib/applications/verification-page";
import { checkAccess, isAllowedEmail } from "@/lib/auth/session";
import { createAdminClient, createAuthClient } from "@/lib/supabase/server";
import { ACCESS_CHANNEL, type AccessMessage, type AccessProfile, type AccessStatus, type AccessStep } from "./channel";
import { confirmAccessPass, createAccessPass, readAccessPass } from "./verification";

type Metadata = { full_name?: string; name?: string; given_name?: string; family_name?: string };

/** The popup's last page. Opened without a popup, it goes back to the sign-in page's request form. */
export function accessFinishPage(status: AccessStatus, profile: AccessProfile | null = null) {
  return finishPage({
    channel: ACCESS_CHANNEL,
    message: { status, profile } satisfies AccessMessage,
    ok: status === "verified" || status === "confirmed",
    fallback: `/portal/login?access=${status}`,
    backLabel: "Back to your request",
  });
}

/**
 * Google sends people back to the portal's callback; when the sign-in was started from Request
 * access, the callback hands over here. Like applicant verification, the Google session ends
 * straight away and only a signed pass or confirmation is kept (verification.ts).
 */
export async function finishAccessVerification(code: string | null, step: AccessStep) {
  if (!code) return accessFinishPage("failed");

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data?.user?.email?.trim().toLowerCase();
  const metadata = { ...(data?.user?.identities?.[0]?.identity_data ?? {}), ...(data?.user?.user_metadata ?? {}) } as Metadata;
  await supabase.auth.signOut({ scope: "local" });

  const access = email ? await checkAccess(email) : null;
  // Keep no sign-in record for someone without portal access; approving them doesn't need one.
  if (data?.user && !(access && "user" in access)) {
    const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(data.user.id);
    if (deleteError) console.error("Couldn’t delete the requester’s sign-in record:", deleteError.message);
  }

  if (error || !email || !access) return accessFinishPage("failed");
  if (!isAllowedEmail(email)) return accessFinishPage("not-ust");
  if ("user" in access) return accessFinishPage("has-access");
  if (access.denied === "revoked") return accessFinishPage("revoked");

  if (step === "verify") {
    const profile = { email, firstName: metadata.given_name?.trim() ?? "", lastName: metadata.family_name?.trim() ?? "" };
    await createAccessPass(profile);
    return accessFinishPage("verified", profile);
  }

  const pass = await readAccessPass();
  if (!pass) return accessFinishPage("expired");
  if (pass.email !== email) return accessFinishPage("mismatch");
  await confirmAccessPass(pass);
  return accessFinishPage("confirmed", { email: pass.email, firstName: pass.firstName, lastName: pass.lastName });
}
