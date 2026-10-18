import "server-only";

import { addAccountNotice } from "@/lib/filing-portal/accounts";
import type { PublicAccount } from "@/lib/filing-portal/types";
import { later, sendAutomatic } from "@/lib/notifications/notify";
import { unitName } from "@/lib/party-portal/types";
import { activityStatusLabel, materialStatusLabel } from "./campaign";
import { campaignReviewEmail, type CampaignReviewed } from "./campaign-emails";
import type { Candidacy } from "./types";

/** The unit reviewed a campaign material or an activity: a line in the candidate's Announcements, and the email. */
export async function noticeCampaignReviewed(candidacy: Candidacy, candidate: PublicAccount, reviewed: CampaignReviewed) {
  const label = reviewed.kind === "material" ? materialStatusLabel[reviewed.item.status] : activityStatusLabel[reviewed.item.status];
  await addAccountNotice({
    accountId: candidate.id, kind: `campaign-${reviewed.kind}-${reviewed.item.status}`, title: `${label}: ${reviewed.item.title}`, body: reviewed.item.feedback,
    href: reviewed.kind === "material" ? "/filing/candidacy/materials" : "/filing/candidacy/schedule", actor: unitName(candidacy.college),
  });
  const firstName = candidate.firstName.split(" ")[0] || candidate.firstName;
  later(() => sendAutomatic("campaign-review", () => campaignReviewEmail({ firstName, email: candidate.email }, candidacy, reviewed)));
}
