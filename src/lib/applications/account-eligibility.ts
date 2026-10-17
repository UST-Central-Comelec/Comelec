import { formatOfferDate } from "./offer";

/**
 * Existing commission accounts, scoped to the unit rather than the person's role, and the units
 * they're waiting to apply to again after declining an offer or letting it lapse (./offer.ts).
 */
export type CommissionAccounts = { central: boolean; colleges: string[]; holds?: Array<{ body: string; college: string; reason: "declined" | "lapsed"; until: string }> };

/** Whether they already have an account in the unit (revoked ones too). */
export const hasUnitAccount = (accounts: CommissionAccounts | undefined, body: string, college: string) =>
  Boolean(body === "central" ? accounts?.central : body === "local" && accounts?.colleges.includes(college));

export function existingCommissionAccount(accounts: CommissionAccounts | undefined, body: string, college: string): string | null {
  if (body === "central" && accounts?.central) return "You already have a Central Commission Account.";
  if (body === "local" && accounts?.colleges.includes(college)) return `You already have a Local Commission Account in ${college}.`;
  const hold = accounts?.holds?.find((item) => item.body === body && item.college === (body === "local" ? college : "") && new Date(item.until).getTime() > Date.now());
  if (hold) return `${hold.reason === "lapsed" ? "Your offer from this unit lapsed" : "You declined this unit’s offer"}, so you can apply to it again from ${formatOfferDate(hold.until)}. To be considered sooner, contact the commission.`;
  return null;
}
