/** Existing commission accounts, scoped to the unit rather than the person's role. */
export type CommissionAccounts = { central: boolean; colleges: string[] };

export function existingCommissionAccount(accounts: CommissionAccounts | undefined, body: string, college: string): string | null {
  if (body === "central" && accounts?.central) return "You already have a Central Commission Account.";
  if (body === "local" && accounts?.colleges.includes(college)) return `You already have a Local Commission Account in ${college}.`;
  return null;
}
