import "server-only";

import { fullName, upperName } from "@/lib/data/accounts";
import { isMissingColumn, store } from "@/lib/data/store";
import type { Affiliation, CommissionerPosition } from "@/lib/data/types";
import type { Declaration } from "@/lib/onboarding/documents";

// The account an approved access request becomes: on approval under Accounts, or straight away for
// a request sent from an accepted applicant's "Join the Commission" link. Their email is already
// verified: they proved it with Google twice to send the request. The onboarding declarations they
// accepted go with it, and stay on the account after the request itself is deleted.

export type RequestedAccount = {
  email: string;
  lastName: string;
  firstName: string;
  middleInitial: string;
  /** Empty on older requests that collected only an initial. */
  middleName?: string;
  studentNumber: string;
  contactNumber: string | null;
  affiliation: Affiliation;
  position: CommissionerPosition;
  role: string;
  college: string;
  program: string;
  /** The key ("1", "g11"). */
  yearLevel: string | null;
  facebookUrl: string | null;
  declarations: Declaration[];
};

export async function addRequestedAccount(account: RequestedAccount, author: string) {
  // Names are kept in capitals, as the request form sends them.
  const firstName = upperName(account.firstName);
  const lastName = upperName(account.lastName);
  const middleName = account.middleName ? upperName(account.middleName) : "";
  const fields = {
    kind: "personal" as const,
    name: fullName({ firstName, middleInitial: account.middleInitial, middleName, lastName }),
    lastName,
    firstName,
    middleInitial: account.middleInitial || null,
    email: account.email,
    studentNumber: account.studentNumber,
    affiliation: account.affiliation,
    position: account.position,
    role: account.role,
    college: account.college,
    program: account.program,
    facebookUrl: account.facebookUrl,
    emailVerifiedAt: new Date().toISOString(),
    photoUrl: null,
    chamberRole: null,
    active: true,
  };
  const label = `account ${firstName} ${lastName}`;
  // Added by supabase/migrations/0041 and 0074; the account still goes in without them.
  const added = { middleName: middleName || null, yearLevel: account.yearLevel || null, declarations: account.declarations, contactNumber: account.contactNumber };
  try {
    return await store.create("accounts", { ...fields, ...added }, author, label);
  } catch (error) {
    if (!isMissingColumn(error, ["middle_name", "year_level", "declarations", "contact_number"])) throw error;
    console.error("Account added without its onboarding details; run supabase/migrations/0074_onboarding_declarations.sql.");
    return store.create("accounts", fields, author, label);
  }
}
