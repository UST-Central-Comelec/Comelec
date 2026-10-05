import "server-only";

import { later, sendAutomatic } from "@/lib/notifications/notify";
import type { ReceiptSection } from "@/lib/notifications/receipt";
import { filingReceivedEmail, filingResultEmail, type Filing } from "./emails";

// What the Political Party Registration and Filing of Candidacy forms call, once they're built.
// Each email goes after the response, and only if its switch is on under Email Sender → Automatic.

const keys = {
  "party-registration": { received: "party-received", result: "party-result" },
  candidacy: { received: "candidacy-received", result: "candidacy-result" },
} as const;

/** Once a filing is saved: the receipt to whoever filed it. */
export function filingReceived(filing: Filing, answers: ReceiptSection[] = []) {
  later(() => sendAutomatic(keys[filing.kind].received, () => filingReceivedEmail(filing, answers)));
}

/** Once the commission decides a filing: the result to whoever filed it. `remarks` is what it wrote with the decision. */
export function filingDecided(filing: Filing, approved: boolean, remarks = "") {
  later(() => sendAutomatic(keys[filing.kind].result, () => filingResultEmail(filing, approved, remarks)));
}
