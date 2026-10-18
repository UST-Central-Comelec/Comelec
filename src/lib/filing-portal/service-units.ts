import "server-only";

import { comelecUnits } from "@/lib/applications/options";
import { ensureReferenceData } from "@/lib/reference/store";
import type { FilingAccount } from "./session";
import { unitChoicesFor } from "./services";

/** The units the account can turn to: the Central Comelec (""), and its college's, its party's and its candidacy's. */
export async function unitsOf({ account, membership, candidacy }: FilingAccount) {
  await ensureReferenceData();
  return unitChoicesFor([account.college, membership?.member.status === "active" ? membership.party.college : null, candidacy?.college], comelecUnits);
}
