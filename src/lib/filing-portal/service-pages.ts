import "server-only";

import { unitName } from "@/lib/party-portal/types";
import { onBehalfLabels, type OnBehalf } from "./services";
import { unitsOf } from "./service-units";
import type { FilingAccount } from "./session";

/** What the Services pages offer the account: its units (as the forms pick them, "central" for ""), their names, and whom a request can be for. */
export async function serviceChoices(filing: FilingAccount) {
  const units = await unitsOf(filing);
  const behalf: OnBehalf[] = ["self", ...(filing.membership?.member.status === "active" ? ["party" as const] : []), ...(filing.candidacy ? ["candidacy" as const] : [])];
  return {
    units: units.map((college) => ({ value: college || "central", label: unitName(college) })),
    unitNames: Object.fromEntries(units.map((college) => [college, unitName(college)])) as Record<string, string>,
    behalf: behalf.map((value) => ({ value, label: value === "party" && filing.membership ? `${onBehalfLabels.party}: ${filing.membership.party.name}` : onBehalfLabels[value] })),
  };
}
