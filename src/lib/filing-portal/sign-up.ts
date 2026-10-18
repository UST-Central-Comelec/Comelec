import "server-only";

import { programLocked } from "@/lib/applications/options";
import { createAccount, findAccountByEmail } from "./accounts";
import { profileErrors, profileFields, type SignUpValues } from "./schema";
import type { PublicAccount } from "./types";
import type { FilingPass } from "./verification";

/**
 * The account a sign-up files under: the one this verified email already has (its profile as
 * saved; About you only shows it), or a new one made from About you once its answers check out.
 */
export async function accountForSignUp(pass: FilingPass, values: SignUpValues): Promise<{ account: PublicAccount } | { fieldErrors: Record<string, string> } | { suspended: true }> {
  const existing = await findAccountByEmail(pass.email);
  if (existing?.suspendedAt) return { suspended: true };
  if (existing) return { account: existing };
  const fieldErrors = profileErrors(values);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const profile = profileFields.parse(values);
  const account = await createAccount({
    email: pass.email, lastName: profile.lastName, firstName: profile.firstName, middleName: profile.middleName,
    studentNumber: profile.studentNumber, mobileNumber: profile.contactNumber, facebookUrl: profile.facebookUrl,
    college: profile.college, program: programLocked(profile.college) ? "" : profile.program, yearLevel: profile.yearLevel,
  });
  return { account };
}
