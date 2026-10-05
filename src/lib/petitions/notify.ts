import "server-only";

import { emailUnit, later, sendAutomatic } from "@/lib/notifications/notify";
import type { ReceiptSection } from "@/lib/notifications/receipt";
import { petitionNoticeEmail, petitionReceivedEmail, type Petition } from "./emails";

/**
 * What the Petitions & Cases form calls once a submission is saved: the receipt to whoever
 * submitted it, and the notice to the unit it concerns. A Central one reaches the Central Comelec's
 * official account and Executive Board only; a Local one that college's only. Both go after the
 * response, so a slow mail server never holds up the person submitting, and each only if its switch
 * is on under Email Sender → Automatic.
 */
export function petitionSubmitted(petition: Petition, answers: ReceiptSection[] = []) {
  later(() => sendAutomatic("petition-received", () => petitionReceivedEmail(petition, answers)));
  later(() => emailUnit("petition-notice", petition.concern, (to) => petitionNoticeEmail(to, petition)));
}
