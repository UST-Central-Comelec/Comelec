import "server-only";

import { toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import type { CommissionAccounts } from "./account-eligibility";

/** Include revoked accounts too: their access must be restored instead of creating a duplicate. */
export async function getCommissionAccounts(email: string): Promise<CommissionAccounts> {
  const accounts = (await store.list("accounts")).map(toSummary).filter((account) => account.email.trim().toLowerCase() === email.trim().toLowerCase());
  return {
    central: accounts.some((account) => account.affiliation === "central"),
    colleges: [...new Set(accounts.filter((account) => account.affiliation === "local" && account.college).map((account) => account.college!))],
  };
}
