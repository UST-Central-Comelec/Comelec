import "server-only";

import { later, sendAutomatic } from "@/lib/notifications/notify";
import { addAccountNotice } from "./accounts";
import { accountChangeEmail, type AccountChange } from "./emails";
import type { PublicAccount } from "./types";

// When the commission changes an account itself: a line in its Notifications (when it can still
// read them) and the email that goes with it, sent once the response has gone.

export async function noticeAccountChange(account: PublicAccount, change: AccountChange, unit: string) {
  if (change.kind !== "suspended") await addAccountNotice({ accountId: account.id, kind: `account-${change.kind}`, title: change.kind === "updated" ? "The Comelec corrected your details" : "Your access to the filing portal was restored", actor: unit });
  const firstName = account.firstName.split(" ")[0] || account.firstName;
  later(() => sendAutomatic("filing-account", () => accountChangeEmail({ firstName, email: account.email }, change)));
}
